const db = require('../config/database');
const { paginate, paginationMeta } = require('../utils/helpers');

/**
 * Admin Controller — Platform management, analytics, user management
 */

// Admin dashboard analytics
const getDashboard = async (req, res, next) => {
  try {
    // User counts
    const totalUsers = await db.query(`SELECT COUNT(*) FROM users`);
    const candidateCount = await db.query(`SELECT COUNT(*) FROM users WHERE role = 'candidate'`);
    const recruiterCount = await db.query(`SELECT COUNT(*) FROM users WHERE role = 'recruiter'`);
    const activeToday = await db.query(`SELECT COUNT(*) FROM users WHERE last_login >= CURRENT_DATE`);

    // Assessment counts
    const totalAssessments = await db.query(`SELECT COUNT(*) FROM assessments`);
    const totalQuestions = await db.query(`SELECT COUNT(*) FROM questions`);
    const totalAttempts = await db.query(`SELECT COUNT(*) FROM aptitude_attempts`);

    // Interview counts
    const totalInterviews = await db.query(`SELECT COUNT(*) FROM interview_sessions`);
    const completedInterviews = await db.query(`SELECT COUNT(*) FROM interview_sessions WHERE status = 'completed'`);

    // Coding stats
    const totalProblems = await db.query(`SELECT COUNT(*) FROM coding_problems`);
    const totalSubmissions = await db.query(`SELECT COUNT(*) FROM coding_submissions`);

    // Registration trend (last 30 days)
    const registrationTrend = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE(created_at) ORDER BY date`
    );

    // Daily activity (last 7 days)
    const dailyActivity = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM activity_logs WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(created_at) ORDER BY date`
    );

    // Category distribution
    const categoryDistribution = await db.query(
      `SELECT category, COUNT(*) as count FROM assessments GROUP BY category`
    );

    // Recent system logs
    const recentLogs = await db.query(
      `SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 20`
    );

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers: parseInt(totalUsers.rows[0].count),
          totalCandidates: parseInt(candidateCount.rows[0].count),
          totalRecruiters: parseInt(recruiterCount.rows[0].count),
          activeToday: parseInt(activeToday.rows[0].count),
          totalAssessments: parseInt(totalAssessments.rows[0].count),
          totalQuestions: parseInt(totalQuestions.rows[0].count),
          totalAttempts: parseInt(totalAttempts.rows[0].count),
          totalInterviews: parseInt(totalInterviews.rows[0].count),
          completedInterviews: parseInt(completedInterviews.rows[0].count),
          totalProblems: parseInt(totalProblems.rows[0].count),
          totalSubmissions: parseInt(totalSubmissions.rows[0].count),
        },
        registrationTrend: registrationTrend.rows,
        dailyActivity: dailyActivity.rows,
        categoryDistribution: categoryDistribution.rows,
        recentLogs: recentLogs.rows,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all users
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const { limit: l, offset } = paginate(page, limit);

    let query = `SELECT id, email, first_name, last_name, role, is_active, is_verified, last_login, created_at FROM users WHERE 1=1`;
    const params = [];
    let idx = 1;

    if (role) { query += ` AND role = $${idx++}`; params.push(role); }
    if (search) {
      query += ` AND (first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await db.query(countQuery, params);

    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(l, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: {
        users: result.rows,
        pagination: paginationMeta(parseInt(countResult.rows[0].count), parseInt(page), l),
      }
    });
  } catch (error) {
    next(error);
  }
};

// Toggle user active status
const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING id, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({
      success: true,
      message: `User ${result.rows[0].is_active ? 'activated' : 'deactivated'}.`,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// Get activity logs
const getActivityLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const { limit: l, offset } = paginate(page, limit);

    const result = await db.query(
      `SELECT al.*, u.first_name, u.last_name, u.email
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`,
      [l, offset]
    );

    const countResult = await db.query(`SELECT COUNT(*) FROM activity_logs`);

    res.json({
      success: true,
      data: {
        logs: result.rows,
        pagination: paginationMeta(parseInt(countResult.rows[0].count), parseInt(page), l),
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get system logs
const getSystemLogs = async (req, res, next) => {
  try {
    const { level, page = 1, limit = 50 } = req.query;
    const { limit: l, offset } = paginate(page, limit);

    let query = 'SELECT * FROM system_logs';
    const params = [];
    let idx = 1;

    if (level) { query += ` WHERE level = $${idx++}`; params.push(level); }

    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(l, offset);

    const result = await db.query(query, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

// Delete user
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Don't delete admins
    const user = await db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.rows[0].role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot delete admin users.' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard, getUsers, toggleUserStatus, getActivityLogs, getSystemLogs, deleteUser };
