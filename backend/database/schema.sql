-- ============================================================
-- AI INTERVIEW PLATFORM — PostgreSQL Schema
-- Complete DDL with constraints, indexes, and relationships
-- ============================================================

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS leaderboards CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS interview_answers CASCADE;
DROP TABLE IF EXISTS interview_questions CASCADE;
DROP TABLE IF EXISTS interview_sessions CASCADE;
DROP TABLE IF EXISTS coding_submissions CASCADE;
DROP TABLE IF EXISTS coding_problems CASCADE;
DROP TABLE IF EXISTS aptitude_attempts CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS resume_analysis CASCADE;
DROP TABLE IF EXISTS resumes CASCADE;
DROP TABLE IF EXISTS candidate_profiles CASCADE;
DROP TABLE IF EXISTS recruiters CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create database (run separately if needed)
-- CREATE DATABASE ai_interview_platform;

-- ============================================================
-- USERS TABLE — Central authentication for all roles
-- ============================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('candidate', 'recruiter', 'admin')),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================================
-- REFRESH TOKENS — JWT refresh token storage
-- ============================================================
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================================
-- CANDIDATE PROFILES — Extended info for candidates
-- ============================================================
CREATE TABLE candidate_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20),
    college VARCHAR(255),
    degree VARCHAR(100),
    branch VARCHAR(100),
    graduation_year INTEGER,
    cgpa DECIMAL(4,2),
    skills TEXT[], -- PostgreSQL array of skill strings
    experience_years INTEGER DEFAULT 0,
    bio TEXT,
    linkedin_url VARCHAR(500),
    github_url VARCHAR(500),
    portfolio_url VARCHAR(500),
    location VARCHAR(255),
    overall_score DECIMAL(5,2) DEFAULT 0,
    global_rank INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_candidate_profiles_user ON candidate_profiles(user_id);
CREATE INDEX idx_candidate_profiles_rank ON candidate_profiles(global_rank);
CREATE INDEX idx_candidate_profiles_score ON candidate_profiles(overall_score DESC);

-- ============================================================
-- RECRUITERS — Recruiter company/role info
-- ============================================================
CREATE TABLE recruiters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    designation VARCHAR(100),
    department VARCHAR(100),
    company_website VARCHAR(500),
    phone VARCHAR(20),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recruiters_user ON recruiters(user_id);

-- ============================================================
-- RESUMES — Uploaded resume files
-- ============================================================
CREATE TABLE resumes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(50) DEFAULT 'application/pdf',
    is_primary BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resumes_user ON resumes(user_id);

-- ============================================================
-- RESUME ANALYSIS — Parsed resume data & scores
-- ============================================================
CREATE TABLE resume_analysis (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER UNIQUE NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_text TEXT,
    detected_skills TEXT[],
    detected_education JSONB, -- { degree, institution, year }
    detected_experience JSONB, -- { years, roles: [...] }
    detected_projects JSONB,
    skill_score DECIMAL(5,2) DEFAULT 0,
    education_score DECIMAL(5,2) DEFAULT 0,
    experience_score DECIMAL(5,2) DEFAULT 0,
    formatting_score DECIMAL(5,2) DEFAULT 0,
    overall_score DECIMAL(5,2) DEFAULT 0,
    strengths TEXT[],
    weaknesses TEXT[],
    suggestions TEXT[],
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resume_analysis_user ON resume_analysis(user_id);
CREATE INDEX idx_resume_analysis_resume ON resume_analysis(resume_id);

-- ============================================================
-- ASSESSMENTS — Test/quiz configurations
-- ============================================================
CREATE TABLE assessments (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('aptitude', 'technical', 'logical', 'verbal')),
    difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    total_marks DECIMAL(6,2) DEFAULT 100,
    passing_marks DECIMAL(6,2) DEFAULT 40,
    negative_marking BOOLEAN DEFAULT FALSE,
    negative_mark_value DECIMAL(4,2) DEFAULT 0.25,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    total_questions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assessments_category ON assessments(category);
CREATE INDEX idx_assessments_active ON assessments(is_active);

-- ============================================================
-- QUESTIONS — Question bank for aptitude tests
-- ============================================================
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('mcq', 'multiple_select', 'numerical')),
    options JSONB, -- [{ text, isCorrect }]
    correct_answer TEXT,
    explanation TEXT,
    difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    marks DECIMAL(4,2) DEFAULT 1,
    category VARCHAR(50),
    tags TEXT[],
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_questions_assessment ON questions(assessment_id);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_type ON questions(question_type);

-- ============================================================
-- APTITUDE ATTEMPTS — Candidate test attempts
-- ============================================================
CREATE TABLE aptitude_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    answers JSONB NOT NULL, -- [{ questionId, selectedAnswer, isCorrect, timeTaken }]
    score DECIMAL(6,2) DEFAULT 0,
    total_marks DECIMAL(6,2) DEFAULT 0,
    percentage DECIMAL(5,2) DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    wrong_count INTEGER DEFAULT 0,
    unanswered_count INTEGER DEFAULT 0,
    time_taken_seconds INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'timed_out')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_aptitude_attempts_user ON aptitude_attempts(user_id);
CREATE INDEX idx_aptitude_attempts_assessment ON aptitude_attempts(assessment_id);
CREATE INDEX idx_aptitude_attempts_score ON aptitude_attempts(percentage DESC);

-- ============================================================
-- CODING PROBLEMS — HackerRank-style problems
-- ============================================================
CREATE TABLE coding_problems (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    constraints_text TEXT,
    sample_input TEXT,
    sample_output TEXT,
    hidden_test_cases JSONB, -- [{ input, expectedOutput }]
    time_limit_ms INTEGER DEFAULT 2000,
    memory_limit_mb INTEGER DEFAULT 256,
    tags TEXT[],
    category VARCHAR(50),
    points INTEGER DEFAULT 100,
    success_rate DECIMAL(5,2) DEFAULT 0,
    total_submissions INTEGER DEFAULT 0,
    accepted_submissions INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_coding_problems_difficulty ON coding_problems(difficulty);
CREATE INDEX idx_coding_problems_active ON coding_problems(is_active);

-- ============================================================
-- CODING SUBMISSIONS — Code submission records
-- ============================================================
CREATE TABLE coding_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id INTEGER NOT NULL REFERENCES coding_problems(id) ON DELETE CASCADE,
    source_code TEXT NOT NULL,
    language VARCHAR(20) NOT NULL CHECK (language IN ('cpp', 'python', 'java', 'javascript')),
    status VARCHAR(30) DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'wrong_answer', 'time_limit', 'runtime_error', 'compilation_error')),
    score DECIMAL(5,2) DEFAULT 0,
    test_cases_passed INTEGER DEFAULT 0,
    total_test_cases INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    memory_used_mb DECIMAL(6,2),
    error_output TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_coding_submissions_user ON coding_submissions(user_id);
CREATE INDEX idx_coding_submissions_problem ON coding_submissions(problem_id);
CREATE INDEX idx_coding_submissions_status ON coding_submissions(status);

-- ============================================================
-- INTERVIEW SESSIONS — Mock interview sessions
-- ============================================================
CREATE TABLE interview_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('hr', 'technical', 'behavioral', 'system_design', 'mixed')),
    role_applied VARCHAR(100),
    total_questions INTEGER DEFAULT 0,
    answered_questions INTEGER DEFAULT 0,
    overall_score DECIMAL(5,2) DEFAULT 0,
    keyword_match_avg DECIMAL(5,2) DEFAULT 0,
    strengths TEXT[],
    weaknesses TEXT[],
    recommendations TEXT[],
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_interview_sessions_user ON interview_sessions(user_id);
CREATE INDEX idx_interview_sessions_category ON interview_sessions(category);
CREATE INDEX idx_interview_sessions_status ON interview_sessions(status);

-- ============================================================
-- INTERVIEW QUESTIONS — Questions in each session
-- ============================================================
CREATE TABLE interview_questions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    category VARCHAR(50),
    difficulty VARCHAR(20) DEFAULT 'medium',
    expected_keywords TEXT[],
    sample_answer TEXT,
    question_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_interview_questions_session ON interview_questions(session_id);

-- ============================================================
-- INTERVIEW ANSWERS — Candidate answers + evaluation
-- ============================================================
CREATE TABLE interview_answers (
    id SERIAL PRIMARY KEY,
    question_id INTEGER UNIQUE NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    matched_keywords TEXT[],
    missed_keywords TEXT[],
    keyword_match_percentage DECIMAL(5,2) DEFAULT 0,
    score DECIMAL(5,2) DEFAULT 0,
    feedback TEXT,
    strengths TEXT[],
    improvements TEXT[],
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_interview_answers_session ON interview_answers(session_id);
CREATE INDEX idx_interview_answers_user ON interview_answers(user_id);

-- ============================================================
-- REPORTS — Generated PDF report metadata
-- ============================================================
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('resume', 'aptitude', 'coding', 'interview', 'comprehensive')),
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    data JSONB, -- Report data snapshot
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_user ON reports(user_id);
CREATE INDEX idx_reports_type ON reports(report_type);

-- ============================================================
-- NOTIFICATIONS — User notifications
-- ============================================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'achievement')),
    is_read BOOLEAN DEFAULT FALSE,
    link VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- ============================================================
-- ACTIVITY LOGS — User activity tracking
-- ============================================================
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- ============================================================
-- SYSTEM LOGS — Platform system events
-- ============================================================
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
    message TEXT NOT NULL,
    source VARCHAR(100),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_created ON system_logs(created_at DESC);

-- ============================================================
-- LEADERBOARDS — Cached ranking data
-- ============================================================
CREATE TABLE leaderboards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    aptitude_score DECIMAL(5,2) DEFAULT 0,
    coding_score DECIMAL(5,2) DEFAULT 0,
    interview_score DECIMAL(5,2) DEFAULT 0,
    overall_score DECIMAL(5,2) DEFAULT 0,
    global_rank INTEGER,
    tests_taken INTEGER DEFAULT 0,
    problems_solved INTEGER DEFAULT 0,
    interviews_completed INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leaderboards_rank ON leaderboards(global_rank);
CREATE INDEX idx_leaderboards_score ON leaderboards(overall_score DESC);

-- ============================================================
-- SETTINGS — Platform configuration
-- ============================================================
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
('platform_name', 'AI Interview Platform', 'Platform display name'),
('max_resume_size_mb', '5', 'Maximum resume file size in MB'),
('aptitude_weight', '0.40', 'Weight for aptitude in overall score'),
('coding_weight', '0.40', 'Weight for coding in overall score'),
('interview_weight', '0.20', 'Weight for interview in overall score'),
('max_interview_questions', '10', 'Default number of interview questions per session'),
('allow_registration', 'true', 'Whether new registrations are allowed');

-- ============================================================
-- TRIGGER: Auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_candidate_profiles_updated_at BEFORE UPDATE ON candidate_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_recruiters_updated_at BEFORE UPDATE ON recruiters
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_assessments_updated_at BEFORE UPDATE ON assessments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_leaderboards_updated_at BEFORE UPDATE ON leaderboards
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
