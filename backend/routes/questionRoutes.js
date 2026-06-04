const router = require('express').Router();
const { getQuestions, createQuestion, updateQuestion, deleteQuestion } = require('../controllers/questionController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

router.use(authenticateUser);

router.get('/', getQuestions);
router.post('/', authorizeRoles('recruiter', 'admin'), createQuestion);
router.put('/:id', authorizeRoles('recruiter', 'admin'), updateQuestion);
router.delete('/:id', authorizeRoles('recruiter', 'admin'), deleteQuestion);

module.exports = router;
