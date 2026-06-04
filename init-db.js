require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./backend/config/database');

const initDB = async () => {
  console.log('🔄 Connecting to database...');
  try {
    // 1. Read and execute schema.sql
    console.log('📜 Reading schema.sql...');
    const schemaPath = path.join(__dirname, 'backend', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('⚙️ Executing schema (WARNING: This drops existing tables!)...');
    await db.query(schema);
    console.log('✅ Schema created successfully!');

    // 2. Run the seed script logic
    console.log('🌱 Starting Database Seeding...');
    require('./backend/seed.js');

  } catch (error) {
    console.error('❌ Database Initialization Error:', error);
    process.exit(1);
  }
};

initDB();
