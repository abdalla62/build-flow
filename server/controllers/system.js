const { clearDemoData } = require('../services/clearDemoData');

// @desc    Clear practice/demo business data (keep users + roles)
// @route   POST /api/system/clear-demo-data
// @access  Private (Administrator only)
exports.clearDemoData = async (req, res, next) => {
  try {
    const confirm = String(req.body?.confirm || '').trim().toUpperCase();
    if (confirm !== 'CLEAR') {
      return res.status(400).json({
        success: false,
        error:
          'Type CLEAR in the confirm field to delete practice data. Users will not be deleted.'
      });
    }

    const result = await clearDemoData();

    res.status(200).json({
      success: true,
      message:
        'Practice data cleared for web and mobile. Users and roles were kept.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};
