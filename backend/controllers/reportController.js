const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const reportGenerator = require('../services/reportGenerator');
const scoringEngine = require('../services/scoringEngine');
const { logActivity } = require('../utils/logger');

/**
 * Report Controller — Generate and download PDF reports
 */

const reportsDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

// Generate comprehensive report
const generateReport = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const reportType = req.body.type || 'comprehensive';

    // Gather all data
    const userResult = await db.query(
      `SELECT u.first_name, u.last_name, u.email, cp.college, cp.branch, cp.degree,
              cp.graduation_year, cp.overall_score, cp.global_rank
       FROM users u
       LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
       WHERE u.id = $1`,
      [userId]
    );
    const user = userResult.rows[0];

    // Get scores
    const scores = await scoringEngine.calculateOverallScore(userId);

    // Resume analysis
    const resumeResult = await db.query(
      `SELECT overall_score, detected_skills, strengths, weaknesses, suggestions
       FROM resume_analysis WHERE user_id = $1 ORDER BY analyzed_at DESC LIMIT 1`,
      [userId]
    );
    const resume = resumeResult.rows[0];

    // Aptitude stats
    const aptitudeResult = await db.query(
      `SELECT COUNT(*) as tests_taken, COALESCE(AVG(percentage), 0) as avg_score,
              COALESCE(MAX(percentage), 0) as best_score
       FROM aptitude_attempts WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );
    const aptitude = aptitudeResult.rows[0];

    // Coding stats
    const codingResult = await db.query(
      `SELECT COUNT(DISTINCT problem_id) as solved, 
              COUNT(*) as total_submissions
       FROM coding_submissions WHERE user_id = $1 AND status = 'accepted'`,
      [userId]
    );
    const coding = codingResult.rows[0];

    // Interview stats
    const interviewResult = await db.query(
      `SELECT COUNT(*) as completed, COALESCE(AVG(overall_score), 0) as avg_score,
              COALESCE(AVG(keyword_match_avg), 0) as keyword_avg
       FROM interview_sessions WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );
    const interview = interviewResult.rows[0];

    // Leaderboard rank
    const rankResult = await db.query(
      `SELECT global_rank FROM leaderboards WHERE user_id = $1`, [userId]
    );

    // Prepare report data
    const reportData = {
      candidateName: `${user.first_name} ${user.last_name}`,
      email: user.email,
      college: user.college,
      branch: user.branch,
      degree: user.degree,
      globalRank: rankResult.rows[0]?.global_rank,
      overallScore: scores.overallScore,
      resumeScore: resume ? parseFloat(resume.overall_score) : 0,
      aptitudeScore: scores.aptitudeScore,
      codingScore: scores.codingScore,
      interviewScore: scores.interviewScore,
      skillCount: resume?.detected_skills?.length || 0,
      skills: resume?.detected_skills || [],
      educationLevel: user.degree || 'N/A',
      experienceYears: 0,
      testsTaken: parseInt(aptitude.tests_taken),
      bestAptitudeScore: parseFloat(aptitude.best_score),
      problemsSolved: parseInt(coding.solved),
      acceptanceRate: coding.total_submissions > 0 ? Math.round((parseInt(coding.solved) / parseInt(coding.total_submissions)) * 100) : 0,
      interviewsCompleted: parseInt(interview.completed),
      keywordMatchAvg: Math.round(parseFloat(interview.keyword_avg)),
      recommendations: [
        ...(resume?.suggestions || []),
        scores.aptitudeScore < 60 ? 'Practice more aptitude questions to improve your score.' : null,
        scores.codingScore < 60 ? 'Solve more coding problems across different difficulty levels.' : null,
        scores.interviewScore < 60 ? 'Take more mock interviews and use technical terminology.' : null,
      ].filter(Boolean).slice(0, 6),
    };

    // Generate PDF
    const fileName = `report-${userId}-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, fileName);
    
    await reportGenerator.generateComprehensiveReport(reportData, filePath);

    // Save report record
    const reportRecord = await db.query(
      `INSERT INTO reports (user_id, report_type, title, file_path, file_name, data)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [userId, reportType, `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
       filePath, fileName, JSON.stringify(reportData)]
    );

    await logActivity(userId, 'generate_report', 'report', reportRecord.rows[0].id, { reportType }, req);

    res.json({
      success: true,
      message: 'Report generated successfully.',
      data: {
        reportId: reportRecord.rows[0].id,
        fileName,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Download report PDF
const downloadReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT file_path, file_name FROM reports WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const { file_path, file_name } = result.rows[0];

    if (!fs.existsSync(file_path)) {
      return res.status(404).json({ success: false, message: 'Report file not found.' });
    }

    res.download(file_path, file_name);
  } catch (error) {
    next(error);
  }
};

// Get all reports for current user
const getReports = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, report_type, title, file_name, generated_at
       FROM reports WHERE user_id = $1 ORDER BY generated_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

module.exports = { generateReport, downloadReport, getReports };
