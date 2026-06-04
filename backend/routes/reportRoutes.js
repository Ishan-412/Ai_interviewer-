const router = require('express').Router();
const { generateReport, downloadReport, getReports } = require('../controllers/reportController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);

router.get('/', getReports);
router.post('/generate', generateReport);
router.get('/:id/download', downloadReport);

module.exports = router;
