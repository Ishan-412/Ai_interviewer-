const router = require('express').Router();
const { uploadResume, getAnalysis, getLatestAnalysis, getResumes } = require('../controllers/resumeController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

router.use(authenticateUser);

router.post('/upload', authorizeRoles('candidate'), uploadLimiter, uploadResume);
router.get('/analysis/latest', authorizeRoles('candidate'), getLatestAnalysis);
router.get('/analysis/:id', getAnalysis);
router.get('/', getResumes);

module.exports = router;
