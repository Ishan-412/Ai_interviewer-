/**
 * Utility helper functions
 */

/**
 * Generate a random token string
 */
const generateToken = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

/**
 * Format date to readable string
 */
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Calculate percentage
 */
const calculatePercentage = (obtained, total) => {
  if (total === 0) return 0;
  return Math.round((obtained / total) * 100 * 100) / 100;
};

/**
 * Paginate query results
 */
const paginate = (page = 1, limit = 10) => {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (p - 1) * l;
  return { limit: l, offset, page: p };
};

/**
 * Build pagination response metadata
 */
const paginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

/**
 * Sanitize string to prevent XSS
 */
const sanitize = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

/**
 * Sleep utility for delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  generateToken,
  formatDate,
  calculatePercentage,
  paginate,
  paginationMeta,
  sanitize,
  sleep,
};
