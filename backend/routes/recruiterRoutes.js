const router = require('express').Router();
const { getDashboard, getCandidates, getCandidateDetails } = require('../controllers/recruiterController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

router.use(authenticateUser, authorizeRoles('recruiter', 'admin'));

router.get('/dashboard', getDashboard);
router.get('/candidates', getCandidates);
router.get('/candidates/:id', getCandidateDetails);

module.exports = router;
