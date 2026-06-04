const db = require('../config/database');

/**
 * Simple logger that writes to console and optionally to system_logs table
 */
const logger = {
  info: (message, source = 'system', details = null) => {
    console.log(`ℹ️  [INFO] ${source}: ${message}`);
    logToDb('info', message, source, details);
  },

  warn: (message, source = 'system', details = null) => {
    console.warn(`⚠️  [WARN] ${source}: ${message}`);
    logToDb('warn', message, source, details);
  },

  error: (message, source = 'system', details = null) => {
    console.error(`❌ [ERROR] ${source}: ${message}`);
    logToDb('error', message, source, details);
  },

  debug: (message, source = 'system', details = null) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔍 [DEBUG] ${source}: ${message}`);
    }
  },
};

async function logToDb(level, message, source, details) {
  try {
    await db.query(
      'INSERT INTO system_logs (level, message, source, details) VALUES ($1, $2, $3, $4)',
      [level, message, source, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    // Silently fail — don't let logging errors crash the app
  }
}

/**
 * Log user activity
 */
const logActivity = async (userId, action, entityType = null, entityId = null, details = null, req = null) => {
  try {
    await db.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        action,
        entityType,
        entityId,
        details ? JSON.stringify(details) : null,
        req ? req.ip : null,
        req ? req.get('user-agent') : null,
      ]
    );
  } catch (err) {
    // Silently fail
  }
};

module.exports = { logger, logActivity };
