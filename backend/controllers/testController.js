const db = require('../config/database');
const scoringEngine = require('../services/scoringEngine');
const notificationService = require('../services/notificationService');
const { logActivity } = require('../utils/logger');

/**
 * Test Controller — Aptitude assessments, questions, attempts
 */

// Get all available assessments
const getAssessments = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, title, description, category, difficulty, duration_minutes,
              total_marks, passing_marks, negative_marking, total_questions
       FROM assessments WHERE is_active = TRUE ORDER BY created_at DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

// Get a single assessment with questions
const getAssessment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const assessment = await db.query(
      'SELECT * FROM assessments WHERE id = $1 AND is_active = TRUE', [id]
    );

    if (assessment.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assessment not found.' });
    }

    // Get questions (without correct answers for candidates)
    const questions = await db.query(
      `SELECT id, question_text, question_type, options, difficulty, marks
       FROM questions WHERE assessment_id = $1 ORDER BY RANDOM()`,
      [id]
    );

    // Remove correct answer indicators from options for candidate view
    const sanitizedQuestions = questions.rows.map(q => ({
      ...q,
      options: q.options ? q.options.map(opt => ({ text: opt.text, id: opt.id || opt.text })) : [],
    }));

    res.json({
      success: true,
      data: {
        assessment: assessment.rows[0],
        questions: sanitizedQuestions,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Submit aptitude test attempt
const submitAttempt = async (req, res, next) => {
  try {
    const { id } = req.params; // assessment ID
    const { answers, timeTakenSeconds } = req.body;
    const userId = req.user.id;

    // Get assessment details
    const assessment = await db.query('SELECT * FROM assessments WHERE id = $1', [id]);
    if (assessment.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assessment not found.' });
    }
    const assess = assessment.rows[0];

    // Get questions with correct answers
    const questions = await db.query(
      'SELECT * FROM questions WHERE assessment_id = $1', [id]
    );

    // Evaluate answers
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unanswered = 0;
    const evaluatedAnswers = [];

    for (const question of questions.rows) {
      const submittedAnswer = answers.find(a => a.questionId === question.id);

      if (!submittedAnswer || !submittedAnswer.selectedAnswer) {
        unanswered++;
        evaluatedAnswers.push({
          questionId: question.id,
          selectedAnswer: null,
          correctAnswer: question.correct_answer,
          isCorrect: false,
          status: 'unanswered',
        });
        continue;
      }

      let isCorrect = false;

      if (question.question_type === 'mcq') {
        isCorrect = submittedAnswer.selectedAnswer === question.correct_answer;
      } else if (question.question_type === 'multiple_select') {
        const correct = question.correct_answer.split(',').sort();
        const selected = submittedAnswer.selectedAnswer.split(',').sort();
        isCorrect = JSON.stringify(correct) === JSON.stringify(selected);
      } else if (question.question_type === 'numerical') {
        isCorrect = parseFloat(submittedAnswer.selectedAnswer) === parseFloat(question.correct_answer);
      }

      if (isCorrect) {
        correctCount++;
        score += parseFloat(question.marks);
      } else {
        wrongCount++;
        if (assess.negative_marking) {
          score -= parseFloat(assess.negative_mark_value);
        }
      }

      evaluatedAnswers.push({
        questionId: question.id,
        selectedAnswer: submittedAnswer.selectedAnswer,
        correctAnswer: question.correct_answer,
        isCorrect,
        status: isCorrect ? 'correct' : 'wrong',
        explanation: question.explanation,
      });
    }

    score = Math.max(0, score);
    const totalMarks = parseFloat(assess.total_marks);
    const percentage = Math.round((score / totalMarks) * 100 * 100) / 100;

    // Save attempt
    const attemptResult = await db.query(
      `INSERT INTO aptitude_attempts (user_id, assessment_id, answers, score, total_marks,
       percentage, correct_count, wrong_count, unanswered_count, time_taken_seconds, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed', CURRENT_TIMESTAMP)
       RETURNING id`,
      [userId, id, JSON.stringify(evaluatedAnswers), score, totalMarks,
       percentage, correctCount, wrongCount, unanswered, timeTakenSeconds || 0]
    );

    // Update leaderboard
    await scoringEngine.updateUserLeaderboard(userId);
    await scoringEngine.recalculateRankings();

    // Notification
    const passed = percentage >= parseFloat(assess.passing_marks);
    await notificationService.create(
      userId,
      passed ? 'Test Passed! 🎉' : 'Test Completed 📝',
      `You scored ${percentage}% on "${assess.title}". ${passed ? 'Great job!' : 'Keep practicing!'}`,
      passed ? 'achievement' : 'info'
    );

    await logActivity(userId, 'submit_aptitude_test', 'aptitude_attempt', attemptResult.rows[0].id,
      { assessmentId: id, percentage }, req);

    res.json({
      success: true,
      message: 'Test submitted successfully.',
      data: {
        attemptId: attemptResult.rows[0].id,
        score,
        totalMarks,
        percentage,
        correctCount,
        wrongCount,
        unanswered,
        passed,
        answers: evaluatedAnswers,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get user's attempt history
const getAttemptHistory = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT aa.id, aa.score, aa.total_marks, aa.percentage, aa.correct_count,
              aa.wrong_count, aa.time_taken_seconds, aa.status, aa.completed_at,
              a.title, a.category, a.difficulty
       FROM aptitude_attempts aa
       JOIN assessments a ON aa.assessment_id = a.id
       WHERE aa.user_id = $1
       ORDER BY aa.completed_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

// Create assessment (recruiter/admin)
const createAssessment = async (req, res, next) => {
  try {
    const { title, description, category, difficulty, durationMinutes, totalMarks, passingMarks, negativeMarking, negativeMarkValue } = req.body;

    const result = await db.query(
      `INSERT INTO assessments (title, description, category, difficulty, duration_minutes,
       total_marks, passing_marks, negative_marking, negative_mark_value, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [title, description, category, difficulty || 'medium', durationMinutes || 30,
       totalMarks || 100, passingMarks || 40, negativeMarking || false,
       negativeMarkValue || 0.25, req.user.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAssessments, getAssessment, submitAttempt, getAttemptHistory, createAssessment };
