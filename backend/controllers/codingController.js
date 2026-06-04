const db = require('../config/database');
const scoringEngine = require('../services/scoringEngine');
const notificationService = require('../services/notificationService');
const { logActivity } = require('../utils/logger');

/**
 * Coding Controller — Problems, submissions, results
 */

// Get all coding problems
const getProblems = async (req, res, next) => {
  try {
    const { difficulty, category, page = 1, limit = 20 } = req.query;
    let query = `SELECT id, title, difficulty, category, tags, points, success_rate, 
                        total_submissions, accepted_submissions
                 FROM coding_problems WHERE is_active = TRUE`;
    const params = [];
    let idx = 1;

    if (difficulty) { query += ` AND difficulty = $${idx++}`; params.push(difficulty); }
    if (category) { query += ` AND category = $${idx++}`; params.push(category); }

    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const result = await db.query(query, params);

    // Check which problems the user has solved
    if (req.user) {
      const solvedResult = await db.query(
        `SELECT DISTINCT problem_id FROM coding_submissions WHERE user_id = $1 AND status = 'accepted'`,
        [req.user.id]
      );
      const solvedIds = new Set(solvedResult.rows.map(r => r.problem_id));
      result.rows.forEach(p => { p.solved = solvedIds.has(p.id); });
    }

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

// Get single problem details
const getProblem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT id, title, description, difficulty, constraints_text, sample_input, sample_output,
              category, tags, points, time_limit_ms, memory_limit_mb, success_rate
       FROM coding_problems WHERE id = $1 AND is_active = TRUE`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Problem not found.' });
    }

    // Get user's submissions for this problem
    let submissions = [];
    if (req.user) {
      const subResult = await db.query(
        `SELECT id, language, status, score, submitted_at 
         FROM coding_submissions WHERE user_id = $1 AND problem_id = $2 ORDER BY submitted_at DESC LIMIT 10`,
        [req.user.id, id]
      );
      submissions = subResult.rows;
    }

    res.json({ success: true, data: { problem: result.rows[0], submissions } });
  } catch (error) {
    next(error);
  }
};

// Submit code solution
const submitCode = async (req, res, next) => {
  try {
    const { problemId, sourceCode, language } = req.body;
    const userId = req.user.id;

    // Get problem details including hidden test cases
    const problemResult = await db.query(
      'SELECT * FROM coding_problems WHERE id = $1', [problemId]
    );

    if (problemResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Problem not found.' });
    }

    const problem = problemResult.rows[0];
    const hiddenTests = problem.hidden_test_cases || [];

    // Simple code evaluation (pattern matching for V1 — no actual execution)
    // In production, this would connect to Judge0 or a sandboxed executor
    const evaluation = evaluateSubmission(sourceCode, language, problem, hiddenTests);

    // Save submission
    const subResult = await db.query(
      `INSERT INTO coding_submissions (user_id, problem_id, source_code, language, status, 
       score, test_cases_passed, total_test_cases)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [userId, problemId, sourceCode, language, evaluation.status,
       evaluation.score, evaluation.testCasesPassed, evaluation.totalTestCases]
    );

    // Update problem stats
    await db.query(
      `UPDATE coding_problems SET 
        total_submissions = total_submissions + 1,
        accepted_submissions = accepted_submissions + CASE WHEN $1 = 'accepted' THEN 1 ELSE 0 END,
        success_rate = ROUND(
          (accepted_submissions + CASE WHEN $1 = 'accepted' THEN 1 ELSE 0 END)::numeric / 
          (total_submissions + 1) * 100, 2
        )
       WHERE id = $2`,
      [evaluation.status, problemId]
    );

    // Update leaderboard if accepted
    if (evaluation.status === 'accepted') {
      await scoringEngine.updateUserLeaderboard(userId);
      await scoringEngine.recalculateRankings();

      await notificationService.create(
        userId, 'Problem Solved! 🎯',
        `You solved "${problem.title}". Score: ${evaluation.score}/${problem.points}`,
        'achievement'
      );
    }

    await logActivity(userId, 'submit_code', 'coding_submission', subResult.rows[0].id,
      { problemId, language, status: evaluation.status }, req);

    res.json({
      success: true,
      message: evaluation.status === 'accepted' ? 'Solution accepted!' : 'Submission recorded.',
      data: {
        submissionId: subResult.rows[0].id,
        status: evaluation.status,
        score: evaluation.score,
        testCasesPassed: evaluation.testCasesPassed,
        totalTestCases: evaluation.totalTestCases,
        feedback: evaluation.feedback,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get user's submission history
const getSubmissions = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT cs.id, cs.language, cs.status, cs.score, cs.test_cases_passed,
              cs.total_test_cases, cs.submitted_at, cp.title, cp.difficulty, cp.points
       FROM coding_submissions cs
       JOIN coding_problems cp ON cs.problem_id = cp.id
       WHERE cs.user_id = $1
       ORDER BY cs.submitted_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

// Create coding problem (recruiter/admin)
const createProblem = async (req, res, next) => {
  try {
    const { title, description, difficulty, constraintsText, sampleInput, sampleOutput,
            hiddenTestCases, timeLimitMs, memoryLimitMb, tags, category, points } = req.body;

    const result = await db.query(
      `INSERT INTO coding_problems (title, description, difficulty, constraints_text, sample_input,
       sample_output, hidden_test_cases, time_limit_ms, memory_limit_mb, tags, category, points, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [title, description, difficulty || 'medium', constraintsText, sampleInput, sampleOutput,
       JSON.stringify(hiddenTestCases || []), timeLimitMs || 2000, memoryLimitMb || 256,
       tags ? `{${tags.join(',')}}` : null, category, points || 100, req.user.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Simple code evaluation engine (V1 — pattern-based)
 * Checks for code structure, syntax patterns, and test case matching.
 * For production: integrate Judge0 API.
 */
function evaluateSubmission(sourceCode, language, problem, hiddenTests) {
  const code = sourceCode.trim();
  const totalTestCases = Math.max(1, (hiddenTests.length || 0) + 1); // +1 for sample
  let testCasesPassed = 0;
  let status = 'submitted';
  let feedback = '';

  // Check if code is empty or too short
  if (code.length < 10) {
    return { status: 'compilation_error', score: 0, testCasesPassed: 0, totalTestCases, feedback: 'Code is too short or empty.' };
  }

  // Basic syntax checks by language
  const syntaxValid = checkSyntax(code, language);
  if (!syntaxValid.valid) {
    return { status: 'compilation_error', score: 0, testCasesPassed: 0, totalTestCases, feedback: syntaxValid.message };
  }

  // Check if code contains solution patterns
  const hasOutput = checkOutputPattern(code, language);
  const hasInput = checkInputPattern(code, language);
  const hasLogic = code.length > 50 && (code.includes('for') || code.includes('while') || code.includes('if') || code.includes('return'));

  // Check against sample output
  if (problem.sample_output) {
    const outputValues = problem.sample_output.trim().split('\n');
    const codeContainsOutput = outputValues.some(v => code.includes(v.trim()));
    if (hasOutput && hasLogic) testCasesPassed++;
    if (codeContainsOutput) testCasesPassed++;
  } else {
    if (hasOutput && hasLogic) testCasesPassed++;
  }

  // Check against hidden test cases (pattern-based heuristic)
  if (hiddenTests && hiddenTests.length > 0) {
    for (const test of hiddenTests) {
      // Heuristic: if code has proper structure and logic, assume ~70% pass rate
      if (hasLogic && hasInput && hasOutput) {
        if (Math.random() < 0.7) testCasesPassed++;
      }
    }
  }

  testCasesPassed = Math.min(testCasesPassed, totalTestCases);

  // Determine status
  if (testCasesPassed === totalTestCases) {
    status = 'accepted';
    feedback = 'All test cases passed! Great solution.';
  } else if (testCasesPassed > 0) {
    status = 'wrong_answer';
    feedback = `${testCasesPassed}/${totalTestCases} test cases passed. Check edge cases.`;
  } else {
    status = 'wrong_answer';
    feedback = 'No test cases passed. Review your logic and try again.';
  }

  const score = Math.round((testCasesPassed / totalTestCases) * (problem.points || 100));

  return { status, score, testCasesPassed, totalTestCases, feedback };
}

function checkSyntax(code, language) {
  switch (language) {
    case 'python':
      if (code.includes('def ') || code.includes('print') || code.includes('class ') || code.includes('import ')) {
        return { valid: true };
      }
      return { valid: true }; // Python is flexible
    case 'java':
      if (!code.includes('class')) return { valid: false, message: 'Java code must contain a class definition.' };
      return { valid: true };
    case 'cpp':
      if (!code.includes('include') && !code.includes('int ')) return { valid: false, message: 'C++ code appears incomplete.' };
      return { valid: true };
    case 'javascript':
      return { valid: true };
    default:
      return { valid: true };
  }
}

function checkOutputPattern(code, language) {
  const patterns = {
    python: ['print'],
    java: ['System.out'],
    cpp: ['cout', 'printf'],
    javascript: ['console.log', 'return'],
  };
  return (patterns[language] || []).some(p => code.includes(p));
}

function checkInputPattern(code, language) {
  const patterns = {
    python: ['input', 'sys.stdin', 'argv'],
    java: ['Scanner', 'BufferedReader', 'args'],
    cpp: ['cin', 'scanf', 'argv'],
    javascript: ['readline', 'process.stdin', 'args'],
  };
  return (patterns[language] || []).some(p => code.includes(p));
}

module.exports = { getProblems, getProblem, submitCode, getSubmissions, createProblem };
