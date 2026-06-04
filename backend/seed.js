require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('./config/database');
const bcrypt = require('bcrypt');

const seedData = async () => {
  console.log('🌱 Starting Database Seeding...');

  try {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash('password123', saltRounds);

    // 1. Create Default Users (Admin, Recruiter, Candidate)
    console.log('👤 Creating users...');
    const usersResult = await db.query(`
      INSERT INTO users (first_name, last_name, email, password_hash, role, is_verified)
      VALUES 
        ('Super', 'Admin', 'admin@ai-interview.com', $1, 'admin', true),
        ('John', 'Recruiter', 'recruiter@ai-interview.com', $1, 'recruiter', true),
        ('Alice', 'Candidate', 'candidate@ai-interview.com', $1, 'candidate', true)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, role;
    `, [passwordHash]);
    
    // If they already exist, just fetch their IDs
    let adminId, recruiterId, candidateId;
    
    const allUsers = await db.query('SELECT id, role FROM users');
    adminId = allUsers.rows.find(u => u.role === 'admin')?.id || 1;
    recruiterId = allUsers.rows.find(u => u.role === 'recruiter')?.id || 2;
    candidateId = allUsers.rows.find(u => u.role === 'candidate')?.id || 3;

    // Set up Candidate Profile
    await db.query(`
      INSERT INTO candidate_profiles (user_id, college, branch, degree, graduation_year, skills)
      VALUES ($1, 'Stanford University', 'Computer Science', 'B.S.', 2024, '{"JavaScript", "React", "Node.js", "Python"}')
      ON CONFLICT (user_id) DO NOTHING;
    `, [candidateId]);

    // Initialize Leaderboard
    await db.query(`
      INSERT INTO leaderboards (user_id, overall_score) VALUES ($1, 0)
      ON CONFLICT (user_id) DO NOTHING;
    `, [candidateId]);

    // 2. Create Assessments
    console.log('📝 Creating assessments...');
    const assessmentResult = await db.query(`
      INSERT INTO assessments (title, description, category, difficulty, duration_minutes, total_marks, created_by)
      VALUES 
        ('Software Engineering Aptitude', 'Basic logical reasoning and CS fundamentals.', 'technical', 'medium', 30, 100, $1)
      RETURNING id;
    `, [recruiterId]);
    const assessmentId = assessmentResult.rows[0].id;

    // 3. Create Aptitude Questions
    console.log('❓ Creating questions...');
    await db.query(`
      INSERT INTO questions (assessment_id, question_text, question_type, options, correct_answer, explanation, difficulty, marks, created_by)
      VALUES 
        ($1, 'What is the time complexity of binary search?', 'mcq', '[{"id": "A", "text": "O(1)"}, {"id": "B", "text": "O(n)"}, {"id": "C", "text": "O(log n)"}, {"id": "D", "text": "O(n^2)"}]', 'C', 'Binary search halves the search space at each step.', 'easy', 10, $2),
        ($1, 'Which of the following is NOT a NoSQL database?', 'mcq', '[{"id": "A", "text": "MongoDB"}, {"id": "B", "text": "Cassandra"}, {"id": "C", "text": "PostgreSQL"}, {"id": "D", "text": "Redis"}]', 'C', 'PostgreSQL is a relational SQL database.', 'easy', 10, $2),
        ($1, 'What does REST stand for?', 'mcq', '[{"id": "A", "text": "Representational State Transfer"}, {"id": "B", "text": "Realtime State Transfer"}, {"id": "C", "text": "Remote Server Transfer"}, {"id": "D", "text": "Random Execution State"}]', 'A', 'REST is an architectural style.', 'easy', 10, $2)
    `, [assessmentId, recruiterId]);

    // Update assessment question count
    await db.query(`UPDATE assessments SET total_questions = 3 WHERE id = $1`, [assessmentId]);

    // 4. Create Coding Problems
    console.log('💻 Creating coding problems...');
    await db.query(`
      INSERT INTO coding_problems (title, description, difficulty, constraints_text, sample_input, sample_output, hidden_test_cases, time_limit_ms, memory_limit_mb, category, points, created_by)
      VALUES 
        ('Two Sum', 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.', 'easy', '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9', '[2,7,11,15]\n9', '[0,1]', '[{"input": "[3,2,4]\\n6", "output": "[1,2]"}]', 2000, 256, 'algorithms', 100, $1),
        ('Fibonacci Number', 'The Fibonacci numbers form a sequence, where each number is the sum of the two preceding ones. Given n, calculate F(n).', 'easy', '0 <= n <= 30', '2', '1', '[{"input": "4", "output": "3"}]', 1000, 128, 'algorithms', 50, $1)
    `, [recruiterId]);

    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
};

seedData();
