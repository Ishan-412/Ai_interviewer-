const db = require('../config/database');

/**
 * Question Controller — CRUD for question bank
 */

// Get questions (with filters)
const getQuestions = async (req, res, next) => {
  try {
    const { assessmentId, category, difficulty, type, page = 1, limit = 20 } = req.query;
    let query = 'SELECT * FROM questions WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (assessmentId) {
      query += ` AND assessment_id = $${paramIndex++}`;
      params.push(assessmentId);
    }
    if (category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }
    if (difficulty) {
      query += ` AND difficulty = $${paramIndex++}`;
      params.push(difficulty);
    }
    if (type) {
      query += ` AND question_type = $${paramIndex++}`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

// Create a question
const createQuestion = async (req, res, next) => {
  try {
    const { assessmentId, questionText, questionType, options, correctAnswer, explanation, difficulty, marks, category, tags } = req.body;

    const result = await db.query(
      `INSERT INTO questions (assessment_id, question_text, question_type, options, correct_answer,
       explanation, difficulty, marks, category, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [assessmentId, questionText, questionType, JSON.stringify(options), correctAnswer,
       explanation, difficulty || 'medium', marks || 1, category,
       tags ? `{${tags.join(',')}}` : null, req.user.id]
    );

    // Update total questions count
    if (assessmentId) {
      await db.query(
        `UPDATE assessments SET total_questions = (SELECT COUNT(*) FROM questions WHERE assessment_id = $1) WHERE id = $1`,
        [assessmentId]
      );
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

// Update a question
const updateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionText, questionType, options, correctAnswer, explanation, difficulty, marks } = req.body;

    const result = await db.query(
      `UPDATE questions SET
        question_text = COALESCE($1, question_text),
        question_type = COALESCE($2, question_type),
        options = COALESCE($3, options),
        correct_answer = COALESCE($4, correct_answer),
        explanation = COALESCE($5, explanation),
        difficulty = COALESCE($6, difficulty),
        marks = COALESCE($7, marks)
       WHERE id = $8 RETURNING *`,
      [questionText, questionType, options ? JSON.stringify(options) : null,
       correctAnswer, explanation, difficulty, marks, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

// Delete a question
const deleteQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM questions WHERE id = $1 RETURNING assessment_id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    // Update count
    if (result.rows[0].assessment_id) {
      await db.query(
        `UPDATE assessments SET total_questions = (SELECT COUNT(*) FROM questions WHERE assessment_id = $1) WHERE id = $1`,
        [result.rows[0].assessment_id]
      );
    }

    res.json({ success: true, message: 'Question deleted.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getQuestions, createQuestion, updateQuestion, deleteQuestion };
