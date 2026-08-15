const crypto = require('crypto');
const User = require('../models/User');
const logActivity = require('../utils/audit');
const sendEmail = require('../utils/email');

// Helper to create cookie option and return response with token
const sendTokenResponse = (user, statusCode, res, req, actionName) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  // Log action
  logActivity(req, user, actionName, `User ID: ${user._id}`);

  // Don't return password
  user.password = undefined;

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Disabled — accounts are created by Administrator (Users / Suppliers)
exports.register = async (req, res) => {
  return res.status(403).json({
    success: false,
    error: 'Public registration is disabled. Ask an Administrator to create your account.'
  });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide an email and password' });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Email or password is incorrect. Please check and try again.',
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Email or password is incorrect. Please check and try again.',
      });
    }

    if (user.status === 'Inactive') {
      return res.status(403).json({ success: false, error: 'Your account has been deactivated' });
    }

    sendTokenResponse(user, 200, res, req, 'User Login');
  } catch (error) {
    next(error);
  }
};

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    if (req.user) {
      await logActivity(req, req.user, 'User Logout', `User ID: ${req.user._id}`);
    }

    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({ success: false, error: 'There is no user with that email' });
    }

    // Get reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set expire (10 mins)
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // Frontend URL (Vite / production site) — never the API host
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    const message =
      `You requested a password reset for BuildFlow.\n\n` +
      `Open this link (valid 10 minutes):\n${resetUrl}\n\n` +
      `If you did not request this, ignore this email.`;

    const html =
      `<p>You requested a password reset for <strong>BuildFlow</strong>.</p>` +
      `<p><a href="${resetUrl}">Reset your password</a></p>` +
      `<p>Or copy this link (valid 10 minutes):<br/><code>${resetUrl}</code></p>` +
      `<p>If you did not request this, ignore this email.</p>`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'BuildFlow — Reset your password',
        message,
        html
      });

      await logActivity(req, user, 'Forgot Password Requested', `Reset email sent to ${user.email}`);

      const payload = { success: true, data: 'Email sent' };
      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n[DEV] Password reset link: ${resetUrl}\n`);
        payload.resetUrl = resetUrl;
      }
      res.status(200).json(payload);
    } catch (err) {
      console.error('Forgot-password email failed:', err.message || err);

      // Local/dev: keep token and return link so the user can reset without real SMTP
      if (process.env.NODE_ENV !== 'production') {
        console.log('\n========== PASSWORD RESET (dev / SMTP failed) ==========');
        console.log(`User:  ${user.email}`);
        console.log(`Link:  ${resetUrl}`);
        console.log('========================================================\n');

        await logActivity(
          req,
          user,
          'Forgot Password Requested',
          `SMTP failed — reset link returned for ${user.email}`
        );

        return res.status(200).json({
          success: true,
          data: 'Reset link ready (email not configured)',
          resetUrl
        });
      }

      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({ success: false, error: 'Email could not be sent' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    // Hash token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid token' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res, req, 'Password Reset Success');
  } catch (error) {
    next(error);
  }
};

// @desc    Update user details
// @route   PUT /api/auth/profile
// @access  Private
exports.updateDetails = async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, error: 'Full name is required (min 2 characters)' });
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'A valid email address is required' });
    }

    const fieldsToUpdate = { name, email };

    if (req.file) {
      fieldsToUpdate.avatar = `/uploads/avatars/${req.file.filename}`;
    } else if (req.body.avatar === '' || req.body.removeAvatar === 'true') {
      fieldsToUpdate.avatar = '';
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    await logActivity(
      req,
      user,
      'Update Profile Details',
      `Updated profile fields: ${Object.keys(fieldsToUpdate).join(', ')}`
    );

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update password
// @route   PUT /api/auth/change-password
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({ success: false, error: 'Password is incorrect' });
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res, req, 'Password Change Success');
  } catch (error) {
    next(error);
  }
};
