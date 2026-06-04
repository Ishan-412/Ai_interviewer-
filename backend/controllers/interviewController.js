const db = require('../config/database');
const interviewEngine = require('../services/interviewEngine');
const scoringEngine = require('../services/scoringEngine');
const notificationService = require('../services/notificationService');
const { logActivity } = require('../utils/logger');

/**
 * Interview Controller — Mock interview sessions with AI evaluation
 */

// Start a new interview session
const startInterview = async (req, res, next) => {
  try {
    const { category, roleApplied } = req.body;
    const userId = req.user.id;
    const interviewCategory = category || 'mixed';

    // Get questions from the interview question bank
    const questionBank = await db.query(
      `SELECT id, question_text, category, difficulty, expected_keywords, sample_answer
       FROM interview_questions WHERE session_id IS NULL OR session_id = 0`
    );

    // If no standalone questions exist, use questions table with interview tag
    let questions;
    if (questionBank.rows.length > 0) {
      questions = interviewEngine.selectQuestions(
        questionBank.rows.map(q => ({
          ...q,
          expected_keywords: q.expected_keywords || [],
        })),
        interviewCategory,
        10
      );
    } else {
      // Fallback: generate from hardcoded question bank
      questions = getDefaultQuestions(interviewCategory);
    }

    // Create session
    const sessionResult = await db.query(
      `INSERT INTO interview_sessions (user_id, category, role_applied, total_questions, status)
       VALUES ($1, $2, $3, $4, 'in_progress') RETURNING id`,
      [userId, interviewCategory, roleApplied || 'Software Engineer', questions.length]
    );
    const sessionId = sessionResult.rows[0].id;

    // Insert questions for this session
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await db.query(
        `INSERT INTO interview_questions (session_id, question_text, category, difficulty, 
         expected_keywords, sample_answer, question_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sessionId, q.question_text, q.category, q.difficulty,
         `{${(q.expected_keywords || []).map(k => `"${k}"`).join(',')}}`,
         q.sample_answer, i + 1]
      );
    }

    // Get the inserted questions
    const sessionQuestions = await db.query(
      `SELECT id, question_text, category, difficulty, question_order
       FROM interview_questions WHERE session_id = $1 ORDER BY question_order`,
      [sessionId]
    );

    await logActivity(userId, 'start_interview', 'interview_session', sessionId,
      { category: interviewCategory }, req);

    res.status(201).json({
      success: true,
      message: 'Interview session started.',
      data: {
        sessionId,
        category: interviewCategory,
        totalQuestions: questions.length,
        questions: sessionQuestions.rows.map(q => ({
          id: q.id,
          questionText: q.question_text,
          category: q.category,
          difficulty: q.difficulty,
          order: q.question_order,
        })),
      }
    });
  } catch (error) {
    next(error);
  }
};

// Submit answer for a question
const submitAnswer = async (req, res, next) => {
  try {
    const { id } = req.params; // session ID
    const { questionId, answerText } = req.body;
    const userId = req.user.id;

    // Get the question with expected keywords
    const questionResult = await db.query(
      `SELECT * FROM interview_questions WHERE id = $1 AND session_id = $2`,
      [questionId, id]
    );

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Question not found in this session.' });
    }

    const question = questionResult.rows[0];

    // Evaluate answer using interview engine
    const evaluation = interviewEngine.evaluateAnswer(
      answerText,
      question.expected_keywords || [],
      question.difficulty
    );

    // Save answer
    await db.query(
      `INSERT INTO interview_answers (question_id, session_id, user_id, answer_text,
       matched_keywords, missed_keywords, keyword_match_percentage, score, feedback,
       strengths, improvements)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (question_id) DO UPDATE SET
         answer_text = $4, matched_keywords = $5, missed_keywords = $6,
         keyword_match_percentage = $7, score = $8, feedback = $9,
         strengths = $10, improvements = $11, answered_at = CURRENT_TIMESTAMP`,
      [
        questionId, id, userId, answerText,
        `{${evaluation.matchedKeywords.map(k => `"${k}"`).join(',')}}`,
        `{${evaluation.missedKeywords.map(k => `"${k}"`).join(',')}}`,
        evaluation.keywordMatchPercentage, evaluation.score, evaluation.feedback,
        `{${evaluation.strengths.map(s => `"${s.replace(/"/g, "''")}"`).join(',')}}`,
        `{${evaluation.improvements.map(s => `"${s.replace(/"/g, "''")}"`).join(',')}}`,
      ]
    );

    // Update session answered count
    await db.query(
      `UPDATE interview_sessions SET answered_questions = 
       (SELECT COUNT(*) FROM interview_answers WHERE session_id = $1) WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        score: evaluation.score,
        keywordMatchPercentage: evaluation.keywordMatchPercentage,
        matchedKeywords: evaluation.matchedKeywords,
        missedKeywords: evaluation.missedKeywords,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Complete interview session
const completeInterview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get all answers for this session
    const answersResult = await db.query(
      `SELECT score, keyword_match_percentage, matched_keywords, missed_keywords
       FROM interview_answers WHERE session_id = $1 AND user_id = $2`,
      [id, userId]
    );

    const evaluations = answersResult.rows.map(a => ({
      score: parseFloat(a.score),
      keywordMatchPercentage: parseFloat(a.keyword_match_percentage),
      matchedKeywords: a.matched_keywords || [],
      missedKeywords: a.missed_keywords || [],
    }));

    // Generate session summary
    const summary = interviewEngine.generateSessionSummary(evaluations);

    // Update session
    await db.query(
      `UPDATE interview_sessions SET
        status = 'completed', overall_score = $1, keyword_match_avg = $2,
        strengths = $3, weaknesses = $4, recommendations = $5,
        completed_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND user_id = $7`,
      [
        summary.overallScore, summary.keywordMatchAvg,
        `{${summary.strengths.map(s => `"${s.replace(/"/g, "''")}"`).join(',')}}`,
        `{${summary.weaknesses.map(s => `"${s.replace(/"/g, "''")}"`).join(',')}}`,
        `{${summary.recommendations.map(s => `"${s.replace(/"/g, "''")}"`).join(',')}}`,
        id, userId,
      ]
    );

    // Update leaderboard
    await scoringEngine.updateUserLeaderboard(userId);
    await scoringEngine.recalculateRankings();

    // Notification
    await notificationService.create(
      userId, 'Interview Completed! 🎤',
      `Your mock interview scored ${summary.overallScore}/100. View your detailed feedback.`,
      summary.overallScore >= 70 ? 'achievement' : 'info'
    );

    await logActivity(userId, 'complete_interview', 'interview_session', parseInt(id),
      { score: summary.overallScore }, req);

    res.json({
      success: true,
      message: 'Interview completed.',
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

// Get interview session report
const getInterviewReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const session = await db.query(
      `SELECT * FROM interview_sessions WHERE id = $1 AND user_id = $2`, [id, userId]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    const questions = await db.query(
      `SELECT iq.*, ia.answer_text, ia.matched_keywords, ia.missed_keywords,
              ia.keyword_match_percentage, ia.score, ia.feedback, ia.strengths, ia.improvements
       FROM interview_questions iq
       LEFT JOIN interview_answers ia ON iq.id = ia.question_id
       WHERE iq.session_id = $1 ORDER BY iq.question_order`,
      [id]
    );

    res.json({
      success: true,
      data: {
        session: session.rows[0],
        questions: questions.rows,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all interview sessions for user
const getInterviewHistory = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, category, role_applied, total_questions, answered_questions,
              overall_score, keyword_match_avg, status, started_at, completed_at
       FROM interview_sessions WHERE user_id = $1 ORDER BY started_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Default question bank for interviews
 */
function getDefaultQuestions(category) {
  const allQuestions = [
    // HR Questions
    { question_text: 'Tell me about yourself.', category: 'hr', difficulty: 'easy', expected_keywords: ['education', 'experience', 'skills', 'goals', 'passionate'], sample_answer: 'I am a software developer with experience in web technologies...' },
    { question_text: 'Why do you want to work at our company?', category: 'hr', difficulty: 'easy', expected_keywords: ['company', 'culture', 'growth', 'mission', 'values', 'opportunity'], sample_answer: 'I admire your company culture and growth opportunities...' },
    { question_text: 'What are your strengths and weaknesses?', category: 'hr', difficulty: 'easy', expected_keywords: ['strength', 'weakness', 'improvement', 'learning', 'teamwork', 'communication'], sample_answer: 'My strengths include problem-solving and teamwork...' },
    { question_text: 'Where do you see yourself in 5 years?', category: 'hr', difficulty: 'easy', expected_keywords: ['growth', 'career', 'leadership', 'skills', 'contribute', 'role'], sample_answer: 'I see myself growing into a leadership position...' },
    { question_text: 'Describe a challenging situation you faced and how you handled it.', category: 'hr', difficulty: 'medium', expected_keywords: ['challenge', 'solution', 'teamwork', 'result', 'learned', 'approach'], sample_answer: 'During a project deadline, I organized the team and...' },

    // Technical Questions
    { question_text: 'What is a Linked List? Explain its types.', category: 'technical', difficulty: 'easy', expected_keywords: ['node', 'pointer', 'next', 'singly', 'doubly', 'circular', 'dynamic', 'memory'], sample_answer: 'A linked list is a linear data structure where each element (node) points to the next...' },
    { question_text: 'Explain the difference between Stack and Queue.', category: 'technical', difficulty: 'easy', expected_keywords: ['stack', 'queue', 'LIFO', 'FIFO', 'push', 'pop', 'enqueue', 'dequeue', 'top'], sample_answer: 'Stack follows LIFO (Last In First Out) while Queue follows FIFO (First In First Out)...' },
    { question_text: 'What is Object-Oriented Programming? Explain its principles.', category: 'technical', difficulty: 'medium', expected_keywords: ['encapsulation', 'inheritance', 'polymorphism', 'abstraction', 'class', 'object', 'reusability'], sample_answer: 'OOP is a programming paradigm based on objects that contain data and methods...' },
    { question_text: 'Explain the concept of Database Normalization.', category: 'technical', difficulty: 'medium', expected_keywords: ['normalization', '1NF', '2NF', '3NF', 'redundancy', 'dependency', 'primary key', 'atomic'], sample_answer: 'Database normalization is the process of organizing data to reduce redundancy...' },
    { question_text: 'What is the difference between SQL and NoSQL databases?', category: 'technical', difficulty: 'medium', expected_keywords: ['relational', 'non-relational', 'schema', 'scalability', 'ACID', 'flexible', 'table', 'document', 'structured'], sample_answer: 'SQL databases are relational with fixed schemas, while NoSQL databases are non-relational...' },
    { question_text: 'Explain Binary Search Tree and its time complexity.', category: 'technical', difficulty: 'medium', expected_keywords: ['binary', 'tree', 'left', 'right', 'search', 'insert', 'O(log n)', 'balanced', 'node', 'root'], sample_answer: 'A BST is a tree where the left child is smaller and right child is larger than the parent...' },
    { question_text: 'What is REST API? Explain its principles.', category: 'technical', difficulty: 'medium', expected_keywords: ['REST', 'API', 'HTTP', 'GET', 'POST', 'PUT', 'DELETE', 'stateless', 'resource', 'endpoint'], sample_answer: 'REST is an architectural style for designing networked applications...' },
    { question_text: 'Explain the concept of recursion with an example.', category: 'technical', difficulty: 'easy', expected_keywords: ['recursion', 'base case', 'recursive', 'call', 'stack', 'factorial', 'fibonacci', 'self'], sample_answer: 'Recursion is when a function calls itself. Example: factorial(n) = n * factorial(n-1)...' },
    { question_text: 'What are Design Patterns? Name a few.', category: 'technical', difficulty: 'hard', expected_keywords: ['pattern', 'singleton', 'factory', 'observer', 'strategy', 'reusable', 'solution', 'creational', 'behavioral', 'structural'], sample_answer: 'Design patterns are reusable solutions to common software design problems...' },
    { question_text: 'Explain the concept of Dynamic Programming.', category: 'technical', difficulty: 'hard', expected_keywords: ['dynamic', 'programming', 'memoization', 'subproblem', 'optimal', 'overlapping', 'tabulation', 'bottom-up', 'top-down'], sample_answer: 'Dynamic programming solves complex problems by breaking them into overlapping subproblems...' },

    // Behavioral Questions
    { question_text: 'Tell me about a time when you had to work in a team.', category: 'behavioral', difficulty: 'easy', expected_keywords: ['team', 'collaboration', 'communication', 'role', 'contribution', 'result', 'conflict', 'resolution'], sample_answer: 'During a college project, I collaborated with 4 team members...' },
    { question_text: 'How do you handle pressure and tight deadlines?', category: 'behavioral', difficulty: 'medium', expected_keywords: ['prioritize', 'deadline', 'organized', 'calm', 'plan', 'focus', 'time management', 'deliver'], sample_answer: 'I prioritize tasks, break them into smaller milestones...' },
    { question_text: 'Describe a time you showed leadership.', category: 'behavioral', difficulty: 'medium', expected_keywords: ['leadership', 'team', 'initiative', 'decision', 'guide', 'motivate', 'responsibility', 'outcome'], sample_answer: 'As project lead, I organized daily stand-ups and delegated tasks...' },

    // System Design
    { question_text: 'How would you design a URL shortening service like bit.ly?', category: 'system_design', difficulty: 'hard', expected_keywords: ['hash', 'database', 'redirect', 'unique', 'scalability', 'cache', 'API', 'base62', 'collision'], sample_answer: 'Use a hash function to generate short codes, store mappings in a database...' },
    { question_text: 'Design a basic chat application architecture.', category: 'system_design', difficulty: 'hard', expected_keywords: ['websocket', 'real-time', 'server', 'database', 'message', 'user', 'scalability', 'queue', 'notification'], sample_answer: 'Use WebSockets for real-time communication, store messages in a database...' },
  ];

  if (category === 'mixed') return allQuestions;
  return allQuestions.filter(q => q.category === category);
}

module.exports = { startInterview, submitAnswer, completeInterview, getInterviewReport, getInterviewHistory };
