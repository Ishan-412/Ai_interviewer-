const router = require('express').Router();
const { getProblems, getProblem, submitCode, getSubmissions, createProblem } = require('../controllers/codingController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

router.use(authenticateUser);

router.get('/problems', getProblems);
router.get('/problems/:id', getProblem);
router.post('/submit', authorizeRoles('candidate'), submitCode);
router.get('/submissions', authorizeRoles('candidate'), getSubmissions);
router.post('/problems', authorizeRoles('recruiter', 'admin'), createProblem);

module.exports = router;
