const AuditLog = require('../models/AuditLog');

/**
 * Log a user action to the AuditLog collection
 * @param {Object} req Express request object to read IP/User-Agent
 * @param {Object} user User object performing the action
 * @param {string} action Description of action (e.g. 'User Login')
 * @param {string} details Extra metadata/details
 */
const logActivity = async (req, user, action, details = '') => {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await AuditLog.create({
      user: user ? user._id : null,
      userName: user ? user.name : 'System/Guest',
      userEmail: user ? user.email : 'system@procurement.com',
      role: user ? user.role : 'Guest',
      action,
      details,
      ipAddress,
      userAgent
    });
  } catch (error) {
    console.error(`Audit Logging Failed: ${error.message}`);
  }
};

module.exports = logActivity;
