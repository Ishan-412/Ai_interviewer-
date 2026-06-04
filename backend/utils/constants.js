/**
 * Application constants
 */

const ROLES = {
  CANDIDATE: 'candidate',
  RECRUITER: 'recruiter',
  ADMIN: 'admin',
};

const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

const QUESTION_TYPES = {
  MCQ: 'mcq',
  MULTIPLE_SELECT: 'multiple_select',
  NUMERICAL: 'numerical',
};

const ASSESSMENT_CATEGORIES = {
  APTITUDE: 'aptitude',
  TECHNICAL: 'technical',
  LOGICAL: 'logical',
  VERBAL: 'verbal',
};

const INTERVIEW_CATEGORIES = {
  HR: 'hr',
  TECHNICAL: 'technical',
  BEHAVIORAL: 'behavioral',
  SYSTEM_DESIGN: 'system_design',
  MIXED: 'mixed',
};

const CODING_LANGUAGES = {
  CPP: 'cpp',
  PYTHON: 'python',
  JAVA: 'java',
  JAVASCRIPT: 'javascript',
};

const SUBMISSION_STATUS = {
  SUBMITTED: 'submitted',
  ACCEPTED: 'accepted',
  WRONG_ANSWER: 'wrong_answer',
  TIME_LIMIT: 'time_limit',
  RUNTIME_ERROR: 'runtime_error',
  COMPILATION_ERROR: 'compilation_error',
};

// Skills database for resume analysis
const SKILLS_DATABASE = {
  programming: ['c', 'c++', 'cpp', 'java', 'python', 'javascript', 'typescript', 'go', 'golang', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'perl', 'c#', 'csharp'],
  web: ['html', 'html5', 'css', 'css3', 'react', 'reactjs', 'angular', 'vue', 'vuejs', 'next.js', 'nextjs', 'node.js', 'nodejs', 'express', 'expressjs', 'django', 'flask', 'spring', 'spring boot', 'asp.net', 'jquery', 'bootstrap', 'tailwind', 'sass', 'less', 'webpack'],
  database: ['sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'sqlite', 'oracle', 'cassandra', 'dynamodb', 'firebase', 'elasticsearch'],
  cloud: ['aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'terraform', 'jenkins', 'ci/cd', 'devops'],
  ai_ml: ['machine learning', 'deep learning', 'artificial intelligence', 'ai', 'ml', 'nlp', 'natural language processing', 'computer vision', 'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy', 'data science', 'data analysis'],
  cs_fundamentals: ['data structures', 'algorithms', 'operating systems', 'computer networks', 'dbms', 'oops', 'object oriented programming', 'system design', 'design patterns', 'software engineering'],
  tools: ['git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'slack', 'vs code', 'postman', 'linux', 'unix', 'agile', 'scrum'],
  mobile: ['android', 'ios', 'react native', 'flutter', 'xamarin', 'swift', 'kotlin'],
};

// Education keywords
const EDUCATION_KEYWORDS = {
  degrees: ['b.tech', 'btech', 'b.e', 'be', 'm.tech', 'mtech', 'm.e', 'bsc', 'b.sc', 'msc', 'm.sc', 'bca', 'mca', 'bba', 'mba', 'phd', 'ph.d', 'diploma', 'bachelor', 'master', 'doctorate'],
  institutions: ['university', 'college', 'institute', 'school', 'iit', 'nit', 'iiit', 'bits', 'vit', 'srm', 'manipal'],
};

// Stopwords for NLP processing
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their', 'what',
  'which', 'who', 'whom', 'where', 'when', 'why', 'how', 'not', 'no', 'nor', 'as',
  'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'same', 'very', 'just', 'also', 'than', 'too', 'so',
  'if', 'then', 'because', 'while', 'although', 'though', 'each', 'every', 'all',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'out',
]);

module.exports = {
  ROLES,
  DIFFICULTY,
  QUESTION_TYPES,
  ASSESSMENT_CATEGORIES,
  INTERVIEW_CATEGORIES,
  CODING_LANGUAGES,
  SUBMISSION_STATUS,
  SKILLS_DATABASE,
  EDUCATION_KEYWORDS,
  STOPWORDS,
};
