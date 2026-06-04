const router = require('express').Router();
const { getDashboard, getUsers, toggleUserStatus, getActivityLogs, getSystemLogs, deleteUser } = require('../controllers/adminController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

router.use(authenticateUser, authorizeRoles('admin'));

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.delete('/users/:id', deleteUser);
router.get('/activity-logs', getActivityLogs);
router.get('/system-logs', getSystemLogs);

module.exports = router;
