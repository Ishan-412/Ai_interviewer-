const router = require('express').Router();
const { getDashboard, getLeaderboard, getStats } = require('../controllers/candidateController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

router.use(authenticateUser);

router.get('/dashboard', authorizeRoles('candidate'), getDashboard);
router.get('/leaderboard', getLeaderboard);
router.get('/stats', authorizeRoles('candidate'), getStats);

module.exports = router;
