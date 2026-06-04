const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const resumeAnalyzer = require('../services/resumeAnalyzer');
const notificationService = require('../services/notificationService');
const { logActivity } = require('../utils/logger');

// Configure multer for resume uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `resume-${req.user.id}-${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'), false);
    }
  }
}).single('resume');

/**
 * Resume Controller — Upload, parse, analyze resumes
 */

// Upload and analyze resume
const uploadResume = async (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File too large. Max 5MB.' });
      }
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a PDF file.' });
    }

    try {
      const userId = req.user.id;
      const file = req.file;

      // Save resume record
      const resumeResult = await db.query(
        `INSERT INTO resumes (user_id, file_name, file_path, file_size, is_primary)
         VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
        [userId, file.originalname, file.path, file.size]
      );
      const resumeId = resumeResult.rows[0].id;

      // Mark other resumes as not primary
      await db.query(
        `UPDATE resumes SET is_primary = FALSE WHERE user_id = $1 AND id != $2`,
        [userId, resumeId]
      );

      // Analyze resume
      const analysis = await resumeAnalyzer.analyze(file.path);

      // Store analysis
      await db.query(
        `INSERT INTO resume_analysis (resume_id, user_id, raw_text, detected_skills, detected_education,
         detected_experience, detected_projects, skill_score, education_score, experience_score,
         formatting_score, overall_score, strengths, weaknesses, suggestions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          resumeId, userId, analysis.rawText,
          `{${analysis.detectedSkills.map(s => `"${s}"`).join(',')}}`,
          JSON.stringify(analysis.detectedEducation),
          JSON.stringify(analysis.detectedExperience),
          JSON.stringify(analysis.detectedProjects),
          analysis.skillScore, analysis.educationScore,
          analysis.experienceScore, analysis.formattingScore, analysis.overallScore,
          `{${analysis.strengths.map(s => `"${s}"`).join(',')}}`,
          `{${analysis.weaknesses.map(s => `"${s}"`).join(',')}}`,
          `{${analysis.suggestions.map(s => `"${s}"`).join(',')}}`,
        ]
      );

      // Notification
      await notificationService.create(
        userId,
        'Resume Analyzed! 📄',
        `Your resume scored ${analysis.overallScore}/100. Check your detailed analysis.`,
        analysis.overallScore >= 70 ? 'success' : 'info'
      );

      await logActivity(userId, 'upload_resume', 'resume', resumeId, { score: analysis.overallScore }, req);

      res.status(201).json({
        success: true,
        message: 'Resume uploaded and analyzed successfully.',
        data: {
          resumeId,
          analysis: {
            overallScore: analysis.overallScore,
            skillScore: analysis.skillScore,
            educationScore: analysis.educationScore,
            experienceScore: analysis.experienceScore,
            formattingScore: analysis.formattingScore,
            detectedSkills: analysis.detectedSkills,
            skillsByCategory: analysis.skillsByCategory,
            detectedEducation: analysis.detectedEducation,
            detectedExperience: analysis.detectedExperience,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            suggestions: analysis.suggestions,
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });
};

// Get resume analysis by resume ID
const getAnalysis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT ra.*, r.file_name, r.uploaded_at
       FROM resume_analysis ra
       JOIN resumes r ON ra.resume_id = r.id
       WHERE ra.resume_id = $1 AND ra.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Analysis not found.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

// Get latest resume analysis for current user
const getLatestAnalysis = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT ra.*, r.file_name, r.uploaded_at
       FROM resume_analysis ra
       JOIN resumes r ON ra.resume_id = r.id
       WHERE ra.user_id = $1
       ORDER BY ra.analyzed_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, data: null, message: 'No resume analyzed yet.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

// Get all resumes for current user
const getResumes = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT r.id, r.file_name, r.file_size, r.is_primary, r.uploaded_at,
              ra.overall_score
       FROM resumes r
       LEFT JOIN resume_analysis ra ON r.id = ra.resume_id
       WHERE r.user_id = $1
       ORDER BY r.uploaded_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadResume, getAnalysis, getLatestAnalysis, getResumes };
