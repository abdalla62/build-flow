const Project = require('../models/Project');
const User = require('../models/User');
const logActivity = require('../utils/audit');
const { getProjectBudgetSummary } = require('../utils/projectBudget');

// @desc    Get all projects (paginated + search)
// @route   GET /api/projects
// @access  Private
exports.getProjects = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (status) {
      query.status = status;
    }

    const count = await Project.countDocuments(query);
    const projects = await Project.find(query)
      .populate('manager', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      projects,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalProjects: count
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private
exports.getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).populate('manager', 'name email');
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.status(200).json({ success: true, project });
  } catch (error) {
    next(error);
  }
};

// @desc    Project budget used / remaining (from material requests)
// @route   GET /api/projects/:id/budget
// @access  Private
exports.getProjectBudget = async (req, res, next) => {
  try {
    const summary = await getProjectBudgetSummary(req.params.id);
    if (!summary) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.status(200).json({ success: true, ...summary });
  } catch (error) {
    next(error);
  }
};

// @desc    Create project
// @route   POST /api/projects
// @access  Private/Admin
exports.createProject = async (req, res, next) => {
  try {
    const { name, location, budget, manager, status } = req.body;

    // Validate that the assigned manager is indeed a user with Project Manager role
    const managerUser = await User.findById(manager);
    if (!managerUser) {
      return res.status(400).json({ success: false, error: 'Assigned manager user not found' });
    }

    if (managerUser.role !== 'Project Manager' && managerUser.role !== 'Administrator') {
      return res.status(400).json({ success: false, error: 'Assigned user must be a Project Manager or Administrator' });
    }

    const project = await Project.create({
      name,
      location,
      budget,
      manager,
      status
    });

    await logActivity(req, req.user, 'Create Project', `Project ${name} created. Budget: $${budget}`);

    res.status(201).json({ success: true, project });
  } catch (error) {
    next(error);
  }
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private/Admin
exports.updateProject = async (req, res, next) => {
  try {
    const { name, location, budget, manager, status } = req.body;

    if (manager) {
      const managerUser = await User.findById(manager);
      if (!managerUser) {
        return res.status(400).json({ success: false, error: 'Assigned manager user not found' });
      }
      if (managerUser.role !== 'Project Manager' && managerUser.role !== 'Administrator') {
        return res.status(400).json({ success: false, error: 'Assigned user must be a Project Manager or Administrator' });
      }
    }

    let project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    await logActivity(req, req.user, 'Update Project', `Project ${project.name} modified`);

    res.status(200).json({ success: true, project });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private/Admin
exports.deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    await Project.findByIdAndDelete(req.params.id);

    await logActivity(req, req.user, 'Delete Project', `Project ${project.name} deleted`);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
