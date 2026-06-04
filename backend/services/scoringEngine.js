const db = require('../config/database');
const config = require('../config/env');

/**
 * Scoring Engine — Candidate Ranking Algorithm
 * Calculates composite scores and maintains the leaderboard.
 */
class ScoringEngine {

  /**
   * Calculate overall score for a candidate
   * Formula: 40% Aptitude + 40% Coding + 20% Interview
   */
  async calculateOverallScore(userId) {
    const aptitudeScore = await this.getAptitudeAverage(userId);
    const codingScore = await this.getCodingAverage(userId);
    const interviewScore = await this.getInterviewAverage(userId);

    const { aptitudeWeight, codingWeight, interviewWeight } = config.scoring;

    const overall = Math.round(
      (aptitudeScore * aptitudeWeight +
       codingScore * codingWeight +
       interviewScore * interviewWeight) * 100
    ) / 100;

    return {
      aptitudeScore,
      codingScore,
      interviewScore,
      overallScore: overall,
    };
  }

  /**
   * Get average aptitude test percentage for a user
   */
  async getAptitudeAverage(userId) {
    const result = await db.query(
      `SELECT COALESCE(AVG(percentage), 0) as avg_score, COUNT(*) as total
       FROM aptitude_attempts 
       WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );
    return Math.round(parseFloat(result.rows[0].avg_score) * 100) / 100;
  }

  /**
   * Get average coding submission score for a user
   */
  async getCodingAverage(userId) {
    const result = await db.query(
      `SELECT COALESCE(AVG(score), 0) as avg_score, COUNT(*) as total
       FROM coding_submissions 
       WHERE user_id = $1 AND status = 'accepted'`,
      [userId]
    );
    
    // Also factor in number of problems solved
    const solvedResult = await db.query(
      `SELECT COUNT(DISTINCT problem_id) as solved
       FROM coding_submissions 
       WHERE user_id = $1 AND status = 'accepted'`,
      [userId]
    );

    const avgScore = parseFloat(result.rows[0].avg_score);
    const solved = parseInt(solvedResult.rows[0].solved);
    
    // Bonus for solving more problems (up to 10% bonus)
    const solvedBonus = Math.min(10, solved * 2);
    
    return Math.round(Math.min(100, avgScore + solvedBonus) * 100) / 100;
  }

  /**
   * Get average interview score for a user
   */
  async getInterviewAverage(userId) {
    const result = await db.query(
      `SELECT COALESCE(AVG(overall_score), 0) as avg_score, COUNT(*) as total
       FROM interview_sessions 
       WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );
    return Math.round(parseFloat(result.rows[0].avg_score) * 100) / 100;
  }

  /**
   * Update the leaderboard for a specific user
   */
  async updateUserLeaderboard(userId) {
    const scores = await this.calculateOverallScore(userId);

    // Get counts
    const testsResult = await db.query(
      `SELECT COUNT(*) as count FROM aptitude_attempts WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );
    const problemsResult = await db.query(
      `SELECT COUNT(DISTINCT problem_id) as count FROM coding_submissions WHERE user_id = $1 AND status = 'accepted'`,
      [userId]
    );
    const interviewsResult = await db.query(
      `SELECT COUNT(*) as count FROM interview_sessions WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );

    // Upsert leaderboard entry
    await db.query(
      `INSERT INTO leaderboards (user_id, aptitude_score, coding_score, interview_score, overall_score, tests_taken, problems_solved, interviews_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         aptitude_score = $2, coding_score = $3, interview_score = $4,
         overall_score = $5, tests_taken = $6, problems_solved = $7,
         interviews_completed = $8, updated_at = CURRENT_TIMESTAMP`,
      [
        userId, scores.aptitudeScore, scores.codingScore,
        scores.interviewScore, scores.overallScore,
        parseInt(testsResult.rows[0].count),
        parseInt(problemsResult.rows[0].count),
        parseInt(interviewsResult.rows[0].count),
      ]
    );

    // Update candidate profile
    await db.query(
      `UPDATE candidate_profiles SET overall_score = $1 WHERE user_id = $2`,
      [scores.overallScore, userId]
    );

    return scores;
  }

  /**
   * Recalculate global rankings for all candidates
   */
  async recalculateRankings() {
    // Rank by overall score descending
    await db.query(`
      WITH ranked AS (
        SELECT user_id, RANK() OVER (ORDER BY overall_score DESC) as new_rank
        FROM leaderboards
      )
      UPDATE leaderboards l
      SET global_rank = r.new_rank
      FROM ranked r
      WHERE l.user_id = r.user_id
    `);

    // Also update candidate_profiles
    await db.query(`
      UPDATE candidate_profiles cp
      SET global_rank = l.global_rank
      FROM leaderboards l
      WHERE cp.user_id = l.user_id
    `);
  }

  /**
   * Get leaderboard with pagination
   */
  async getLeaderboard(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    const result = await db.query(
      `SELECT l.*, u.first_name, u.last_name, u.email, cp.college, cp.branch
       FROM leaderboards l
       JOIN users u ON l.user_id = u.id
       LEFT JOIN candidate_profiles cp ON l.user_id = cp.user_id
       ORDER BY l.overall_score DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query('SELECT COUNT(*) FROM leaderboards');
    
    return {
      rankings: result.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }
}

module.exports = new ScoringEngine();
