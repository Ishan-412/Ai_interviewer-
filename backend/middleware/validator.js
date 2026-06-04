const { body, param, query, validationResult } = require('express-validator');

/**
 * Process validation results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

/**
 * Validation schemas
 */
const schemas = {
  register: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('role').isIn(['candidate', 'recruiter']).withMessage('Role must be candidate or recruiter'),
    validate
  ],

  login: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
  ],

  updateProfile: [
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
    body('phone').optional().trim().matches(/^[+]?[\d\s-]{7,15}$/).withMessage('Invalid phone number'),
    validate
  ],

  createAssessment: [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('category').isIn(['aptitude', 'technical', 'logical', 'verbal']).withMessage('Invalid category'),
    body('durationMinutes').isInt({ min: 5, max: 180 }).withMessage('Duration must be 5-180 minutes'),
    validate
  ],

  createQuestion: [
    body('questionText').trim().notEmpty().withMessage('Question text is required'),
    body('questionType').isIn(['mcq', 'multiple_select', 'numerical']).withMessage('Invalid question type'),
    body('options').optional().isArray().withMessage('Options must be an array'),
    body('correctAnswer').trim().notEmpty().withMessage('Correct answer is required'),
    validate
  ],

  submitAnswer: [
    body('answerText').trim().notEmpty().withMessage('Answer text is required'),
    validate
  ],

  createCodingProblem: [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty'),
    validate
  ],

  submitCode: [
    body('sourceCode').trim().notEmpty().withMessage('Source code is required'),
    body('language').isIn(['cpp', 'python', 'java', 'javascript']).withMessage('Invalid language'),
    body('problemId').isInt().withMessage('Problem ID is required'),
    validate
  ],

  idParam: [
    param('id').isInt().withMessage('ID must be a valid integer'),
    validate
  ],
};

module.exports = schemas;
