const db = require('../config/database');

/**
 * Notification Service — Manage user notifications
 */
class NotificationService {

  /**
   * Create a notification for a user
   */
  async create(userId, title, message, type = 'info', link = null) {
    const result = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, title, message, type, link]
    );
    return result.rows[0];
  }

  /**
   * Get notifications for a user
   */
  async getForUser(userId, limit = 20, unreadOnly = false) {
    let query = `SELECT * FROM notifications WHERE user_id = $1`;
    const params = [userId];

    if (unreadOnly) {
      query += ` AND is_read = FALSE`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Mark notification as read
   */
  async markRead(notificationId, userId) {
    await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllRead(userId) {
    await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId) {
    const result = await db.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  }
}

module.exports = new NotificationService();
