const router = require('express').Router();
const { startInterview, submitAnswer, completeInterview, getInterviewReport, getInterviewHistory } = require('../controllers/interviewController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

router.use(authenticateUser, authorizeRoles('candidate'));

router.post('/start', startInterview);
router.post('/:id/answer', submitAnswer);
router.post('/:id/complete', completeInterview);
router.get('/:id/report', getInterviewReport);
router.get('/history', getInterviewHistory);

module.exports = router;
