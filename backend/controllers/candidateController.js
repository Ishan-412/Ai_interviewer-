const db = require('../config/database');
const scoringEngine = require('../services/scoringEngine');
const { paginate, paginationMeta } = require('../utils/helpers');

/**
 * Candidate Controller — Dashboard, leaderboard, stats
 */

// Get candidate dashboard data
const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get scores
    const scores = await scoringEngine.calculateOverallScore(userId);

    // Get resume score
    const resumeResult = await db.query(
      `SELECT overall_score FROM resume_analysis WHERE user_id = $1 ORDER BY analyzed_at DESC LIMIT 1`,
      [userId]
    );
    const resumeScore = resumeResult.rows[0]?.overall_score || 0;

    // Get recent activity
    const activityResult = await db.query(
      `SELECT action, entity_type, created_at FROM activity_logs 
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );

    // Get leaderboard position
    const rankResult = await db.query(
      `SELECT global_rank, tests_taken, problems_solved, interviews_completed 
       FROM leaderboards WHERE user_id = $1`,
      [userId]
    );
    const rank = rankResult.rows[0] || { global_rank: null, tests_taken: 0, problems_solved: 0, interviews_completed: 0 };

    // Get aptitude history for chart
    const aptitudeHistory = await db.query(
      `SELECT percentage, completed_at FROM aptitude_attempts 
       WHERE user_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 10`,
      [userId]
    );

    // Get skill distribution from resume
    const skillResult = await db.query(
      `SELECT detected_skills FROM resume_analysis WHERE user_id = $1 ORDER BY analyzed_at DESC LIMIT 1`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        scores: { ...scores, resumeScore: parseFloat(resumeScore) },
        rank,
        recentActivity: activityResult.rows,
        aptitudeHistory: aptitudeHistory.rows,
        skills: skillResult.rows[0]?.detected_skills || [],
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get leaderboard
const getLeaderboard = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await scoringEngine.getLeaderboard(parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: {
        rankings: result.rankings.map((r, i) => ({
          rank: r.global_rank || i + 1,
          name: `${r.first_name} ${r.last_name}`,
          college: r.college,
          branch: r.branch,
          aptitudeScore: parseFloat(r.aptitude_score),
          codingScore: parseFloat(r.coding_score),
          interviewScore: parseFloat(r.interview_score),
          overallScore: parseFloat(r.overall_score),
          testsTaken: r.tests_taken,
          problemsSolved: r.problems_solved,
          interviewsCompleted: r.interviews_completed,
        })),
        pagination: paginationMeta(result.total, parseInt(page), parseInt(limit)),
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get candidate stats for charts
const getStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Score trends over time
    const aptitudeHistory = await db.query(
      `SELECT percentage as score, completed_at as date, 'aptitude' as type
       FROM aptitude_attempts WHERE user_id = $1 AND status = 'completed' ORDER BY completed_at`,
      [userId]
    );

    const codingHistory = await db.query(
      `SELECT score, submitted_at as date, 'coding' as type
       FROM coding_submissions WHERE user_id = $1 AND status = 'accepted' ORDER BY submitted_at`,
      [userId]
    );

    const interviewHistory = await db.query(
      `SELECT overall_score as score, completed_at as date, 'interview' as type
       FROM interview_sessions WHERE user_id = $1 AND status = 'completed' ORDER BY completed_at`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        aptitudeHistory: aptitudeHistory.rows,
        codingHistory: codingHistory.rows,
        interviewHistory: interviewHistory.rows,
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard, getLeaderboard, getStats };
