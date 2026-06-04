const router = require('express').Router();
const { getAssessments, getAssessment, submitAttempt, getAttemptHistory, createAssessment } = require('../controllers/testController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

router.use(authenticateUser);

router.get('/', getAssessments);
router.get('/history', authorizeRoles('candidate'), getAttemptHistory);
router.get('/:id', getAssessment);
router.post('/:id/attempt', authorizeRoles('candidate'), submitAttempt);
router.post('/', authorizeRoles('recruiter', 'admin'), createAssessment);

module.exports = router;
