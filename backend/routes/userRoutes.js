const router = require('express').Router();
const { getProfile, updateProfile, getNotifications, markNotificationRead, markAllNotificationsRead } = require('../controllers/userController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationRead);
router.put('/notifications/read-all', markAllNotificationsRead);

module.exports = router;
