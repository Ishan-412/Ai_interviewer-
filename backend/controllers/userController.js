const db = require('../config/database');
const notificationService = require('../services/notificationService');

/**
 * User Controller — Profile management for all roles
 */

// Get current user profile
const getProfile = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    let profileData = {};

    if (role === 'candidate') {
      const result = await db.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.avatar_url, u.created_at,
                cp.phone, cp.date_of_birth, cp.gender, cp.college, cp.degree, cp.branch,
                cp.graduation_year, cp.cgpa, cp.skills, cp.experience_years, cp.bio,
                cp.linkedin_url, cp.github_url, cp.portfolio_url, cp.location,
                cp.overall_score, cp.global_rank
         FROM users u
         LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
         WHERE u.id = $1`,
        [id]
      );
      profileData = result.rows[0];
    } else if (role === 'recruiter') {
      const result = await db.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.avatar_url, u.created_at,
                r.company_name, r.designation, r.department, r.company_website, r.phone, r.bio
         FROM users u
         LEFT JOIN recruiters r ON u.id = r.user_id
         WHERE u.id = $1`,
        [id]
      );
      profileData = result.rows[0];
    } else {
      const result = await db.query(
        `SELECT id, email, first_name, last_name, role, avatar_url, created_at
         FROM users WHERE id = $1`,
        [id]
      );
      profileData = result.rows[0];
    }

    res.json({ success: true, data: profileData });
  } catch (error) {
    next(error);
  }
};

// Update user profile
const updateProfile = async (req, res, next) => {
  try {
    const { id, role } = req.user;
    const updates = req.body;

    // Update basic user info
    if (updates.firstName || updates.lastName) {
      await db.query(
        `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name) WHERE id = $3`,
        [updates.firstName, updates.lastName, id]
      );
    }

    // Update role-specific profile
    if (role === 'candidate') {
      await db.query(
        `UPDATE candidate_profiles SET
          phone = COALESCE($1, phone),
          date_of_birth = COALESCE($2, date_of_birth),
          gender = COALESCE($3, gender),
          college = COALESCE($4, college),
          degree = COALESCE($5, degree),
          branch = COALESCE($6, branch),
          graduation_year = COALESCE($7, graduation_year),
          cgpa = COALESCE($8, cgpa),
          skills = COALESCE($9, skills),
          experience_years = COALESCE($10, experience_years),
          bio = COALESCE($11, bio),
          linkedin_url = COALESCE($12, linkedin_url),
          github_url = COALESCE($13, github_url),
          portfolio_url = COALESCE($14, portfolio_url),
          location = COALESCE($15, location)
        WHERE user_id = $16`,
        [
          updates.phone, updates.dateOfBirth, updates.gender,
          updates.college, updates.degree, updates.branch,
          updates.graduationYear, updates.cgpa,
          updates.skills ? `{${updates.skills.join(',')}}` : null,
          updates.experienceYears, updates.bio,
          updates.linkedinUrl, updates.githubUrl, updates.portfolioUrl,
          updates.location, id
        ]
      );
    } else if (role === 'recruiter') {
      await db.query(
        `UPDATE recruiters SET
          company_name = COALESCE($1, company_name),
          designation = COALESCE($2, designation),
          department = COALESCE($3, department),
          company_website = COALESCE($4, company_website),
          phone = COALESCE($5, phone),
          bio = COALESCE($6, bio)
        WHERE user_id = $7`,
        [
          updates.companyName, updates.designation, updates.department,
          updates.companyWebsite, updates.phone, updates.bio, id
        ]
      );
    }

    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (error) {
    next(error);
  }
};

// Get notifications
const getNotifications = async (req, res, next) => {
  try {
    const notifications = await notificationService.getForUser(req.user.id, 30);
    const unreadCount = await notificationService.getUnreadCount(req.user.id);

    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) {
    next(error);
  }
};

// Mark notification as read
const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await notificationService.markRead(id, req.user.id);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    next(error);
  }
};

// Mark all notifications as read
const markAllNotificationsRead = async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, getNotifications, markNotificationRead, markAllNotificationsRead };
