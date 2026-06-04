require('dotenv').config({ path: __dirname + '/../../.env' });

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'ai_interview_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_jwt_secret_key_2024',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_key_2024',
    expire: process.env.JWT_EXPIRE || '15m',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  reportsDir: process.env.REPORTS_DIR || 'reports',
  scoring: {
    aptitudeWeight: 0.40,
    codingWeight: 0.40,
    interviewWeight: 0.20,
  }
};
