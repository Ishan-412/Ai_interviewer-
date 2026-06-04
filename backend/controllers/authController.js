const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const config = require('../config/env');
const { generateToken } = require('../utils/helpers');
const { logActivity } = require('../utils/logger');
const notificationService = require('../services/notificationService');

/**
 * Auth Controller — Registration, Login, Token Refresh, Password Reset
 */

// Register new user
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Check if email already exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id, email, first_name, last_name, role, created_at`,
      [email, passwordHash, firstName, lastName, role]
    );

    const user = result.rows[0];

    // Create role-specific profile
    if (role === 'candidate') {
      await db.query(
        `INSERT INTO candidate_profiles (user_id) VALUES ($1)`,
        [user.id]
      );
      // Initialize leaderboard entry
      await db.query(
        `INSERT INTO leaderboards (user_id) VALUES ($1)`,
        [user.id]
      );
    } else if (role === 'recruiter') {
      const companyName = req.body.companyName || 'Not Specified';
      await db.query(
        `INSERT INTO recruiters (user_id, company_name) VALUES ($1, $2)`,
        [user.id, companyName]
      );
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user.id);

    // Welcome notification
    await notificationService.create(
      user.id,
      'Welcome! 🎉',
      `Welcome to AI Interview Platform, ${firstName}! Start your journey by exploring the dashboard.`,
      'success'
    );

    await logActivity(user.id, 'register', 'user', user.id, { role }, req);

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
        accessToken,
        refreshToken,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await db.query(
      'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Update last login
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user.id);

    await logActivity(user.id, 'login', 'user', user.id, null, req);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
        accessToken,
        refreshToken,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Refresh Token
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required.' });
    }

    // Verify refresh token exists and is valid
    const tokenResult = await db.query(
      `SELECT rt.*, u.email, u.first_name, u.last_name, u.role, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = $1 AND rt.is_revoked = FALSE AND rt.expires_at > CURRENT_TIMESTAMP`,
      [refreshToken]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    const tokenData = tokenResult.rows[0];

    if (!tokenData.is_active) {
      return res.status(403).json({ success: false, message: 'Account deactivated.' });
    }

    // Revoke old refresh token (rotation)
    await db.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE token = $1', [refreshToken]);

    // Generate new tokens
    const user = {
      id: tokenData.user_id,
      email: tokenData.email,
      first_name: tokenData.first_name,
      last_name: tokenData.last_name,
      role: tokenData.role,
    };

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = await generateRefreshToken(user.id);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Logout
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await db.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE token = $1', [refreshToken]);
    }

    if (req.user) {
      await logActivity(req.user.id, 'logout', 'user', req.user.id, null, req);
    }

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

// Forgot Password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const result = await db.query('SELECT id, first_name FROM users WHERE email = $1', [email]);

    // Always return success (don't reveal if email exists)
    if (result.rows.length === 0) {
      return res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
    }

    const user = result.rows[0];
    const resetToken = generateToken(40);
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, expires, user.id]
    );

    // In production, send email. For demo, log to console.
    console.log(`\n🔑 Password Reset Token for ${email}: ${resetToken}\n`);

    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

// Reset Password
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    const result = await db.query(
      `SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > CURRENT_TIMESTAMP`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);

    await db.query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
      [passwordHash, result.rows[0].id]
    );

    res.json({ success: true, message: 'Password reset successful. Please log in.' });
  } catch (error) {
    next(error);
  }
};

// ─── Helper Functions ────────────────────────────────

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expire }
  );
}

async function generateRefreshToken(userId) {
  const token = generateToken(64);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );

  return token;
}

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword };
