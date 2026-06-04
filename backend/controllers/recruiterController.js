const db = require('../config/database');
const { paginate, paginationMeta } = require('../utils/helpers');

/**
 * Recruiter Controller — Dashboard, candidate management, analytics
 */

// Recruiter dashboard data
const getDashboard = async (req, res, next) => {
  try {
    const recruiterId = req.user.id;

    // Total candidates
    const candidateCount = await db.query(
      `SELECT COUNT(*) FROM users WHERE role = 'candidate' AND is_active = TRUE`
    );

    // Assessments created by this recruiter
    const assessmentCount = await db.query(
      `SELECT COUNT(*) FROM assessments WHERE created_by = $1`, [recruiterId]
    );

    // Total test attempts
    const attemptCount = await db.query(`SELECT COUNT(*) FROM aptitude_attempts WHERE status = 'completed'`);

    // Top candidates
    const topCandidates = await db.query(
      `SELECT l.*, u.first_name, u.last_name, u.email, cp.college, cp.branch
       FROM leaderboards l
       JOIN users u ON l.user_id = u.id
       LEFT JOIN candidate_profiles cp ON l.user_id = cp.user_id
       ORDER BY l.overall_score DESC LIMIT 10`
    );

    // Recent activity
    const recentActivity = await db.query(
      `SELECT al.action, al.entity_type, al.created_at, u.first_name, u.last_name
       FROM activity_logs al
       JOIN users u ON al.user_id = u.id
       WHERE al.action IN ('submit_aptitude_test', 'submit_code', 'complete_interview', 'upload_resume')
       ORDER BY al.created_at DESC LIMIT 15`
    );

    // Score distribution
    const scoreDistribution = await db.query(
      `SELECT 
        CASE 
          WHEN overall_score >= 80 THEN 'Excellent (80-100)'
          WHEN overall_score >= 60 THEN 'Good (60-79)'
          WHEN overall_score >= 40 THEN 'Average (40-59)'
          ELSE 'Below Average (0-39)'
        END as range,
        COUNT(*) as count
       FROM leaderboards GROUP BY range ORDER BY range`
    );

    res.json({
      success: true,
      data: {
        stats: {
          totalCandidates: parseInt(candidateCount.rows[0].count),
          totalAssessments: parseInt(assessmentCount.rows[0].count),
          totalAttempts: parseInt(attemptCount.rows[0].count),
        },
        topCandidates: topCandidates.rows,
        recentActivity: recentActivity.rows,
        scoreDistribution: scoreDistribution.rows,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all candidates with filters
const getCandidates = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'overall_score', order = 'DESC' } = req.query;
    const { limit: l, offset } = paginate(page, limit);

    let query = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.created_at, u.last_login,
             cp.college, cp.branch, cp.degree, cp.graduation_year, cp.skills,
             l.aptitude_score, l.coding_score, l.interview_score, l.overall_score,
             l.global_rank, l.tests_taken, l.problems_solved, l.interviews_completed
      FROM users u
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN leaderboards l ON u.id = l.user_id
      WHERE u.role = 'candidate' AND u.is_active = TRUE`;

    const params = [];
    let paramIdx = 1;

    if (search) {
      query += ` AND (u.first_name ILIKE $${paramIdx} OR u.last_name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR cp.college ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    // Count total
    const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await db.query(countQuery, params);

    // Sort and paginate
    const validSorts = ['overall_score', 'first_name', 'created_at', 'aptitude_score', 'coding_score'];
    const sortColumn = validSorts.includes(sortBy) ? sortBy : 'overall_score';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortColumn === 'overall_score' ? 'l.overall_score' : sortColumn === 'first_name' ? 'u.first_name' : sortColumn === 'created_at' ? 'u.created_at' : `l.${sortColumn}`} ${sortOrder} NULLS LAST`;
    query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(l, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: {
        candidates: result.rows,
        pagination: paginationMeta(parseInt(countResult.rows[0].count), parseInt(page), l),
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get single candidate details
const getCandidateDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await db.query(
      `SELECT u.*, cp.*, l.aptitude_score, l.coding_score, l.interview_score,
              l.overall_score, l.global_rank, l.tests_taken, l.problems_solved, l.interviews_completed
       FROM users u
       LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
       LEFT JOIN leaderboards l ON u.id = l.user_id
       WHERE u.id = $1 AND u.role = 'candidate'`,
      [id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' });
    }

    // Get resume analysis
    const resume = await db.query(
      `SELECT overall_score, detected_skills, strengths, weaknesses FROM resume_analysis WHERE user_id = $1 ORDER BY analyzed_at DESC LIMIT 1`,
      [id]
    );

    // Get test history
    const tests = await db.query(
      `SELECT aa.percentage, aa.completed_at, a.title FROM aptitude_attempts aa
       JOIN assessments a ON aa.assessment_id = a.id WHERE aa.user_id = $1 ORDER BY aa.completed_at DESC LIMIT 5`,
      [id]
    );

    res.json({
      success: true,
      data: {
        candidate: user.rows[0],
        resumeAnalysis: resume.rows[0] || null,
        recentTests: tests.rows,
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard, getCandidates, getCandidateDetails };
