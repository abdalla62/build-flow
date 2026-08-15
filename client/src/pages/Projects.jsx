import React, { useState, useEffect, useLayoutEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import { FiPlus, FiBriefcase, FiMapPin, FiDollarSign, FiSearch, FiEdit, FiTrash2 } from 'react-icons/fi';
import { pageCache } from '../utils/pageCache';

const Projects = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator';

  const [projects, setProjects] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors }
  } = useForm();

  const fetchProjects = async ({ soft = false } = {}) => {
    const key = `projects:${currentPage}:${statusFilter || ''}:${search || ''}`;
    const cached = pageCache.get(key);
    if (cached && !soft) {
      setProjects(cached.projects);
      setTotalPages(cached.totalPages);
      setLoading(false);
    } else if (!cached?.projects?.length) {
      setLoading(true);
    }

    try {
      const res = await axios.get('/api/projects', {
        params: {
          page: currentPage,
          search,
          status: statusFilter
        }
      });
      if (res.data.success) {
        setProjects(res.data.projects);
        setTotalPages(res.data.totalPages);
        pageCache.set(key, {
          projects: res.data.projects,
          totalPages: res.data.totalPages
        });
      }
    } catch (err) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const res = await axios.get('/api/users', { params: { limit: 100 } });
      if (res.data.success) {
        // Filter users who are Project Managers or Admins for assignments
        const pms = res.data.users.filter(u => u.role === 'Project Manager' || u.role === 'Administrator');
        setManagers(pms);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useLayoutEffect(() => {
    fetchProjects();
  }, [currentPage, statusFilter]);

  useEffect(() => {
    if (isAdmin) {
      fetchManagers();
    }
  }, [isAdmin]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProjects({ soft: true });
  };

  const handleOpenCreate = () => {
    setEditingProject(null);
    reset({
      name: '',
      location: '',
      budget: '',
      manager: '',
      status: 'Pending'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (project) => {
    setEditingProject(project);
    reset({
      name: project.name,
      location: project.location,
      budget: project.budget,
      manager: project.manager?._id || '',
      status: project.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      const res = await axios.delete(`/api/projects/${id}`);
      if (res.data.success) {
        toast.success('Project deleted successfully');
        pageCache.invalidate('projects:');
        fetchProjects({ soft: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete project');
    }
  };

  const onSubmit = async (data) => {
    if (formSubmitting) return;
    setFormSubmitting(true);
    try {
      if (editingProject) {
        const res = await axios.put(`/api/projects/${editingProject._id}`, data);
        if (res.data.success) {
          toast.success('Project updated successfully');
          setIsModalOpen(false);
          pageCache.invalidate('projects:');
          fetchProjects({ soft: true });
        }
      } else {
        const res = await axios.post('/api/projects', data);
        if (res.data.success) {
          toast.success('Project created successfully');
          setIsModalOpen(false);
          pageCache.invalidate('projects:');
          fetchProjects({ soft: true });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save project');
    } finally {
      setFormSubmitting(false);
    }
  };

  const headers = [
    { key: 'name', label: 'Project details', render: (p) => (
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-brand-primary/10 dark:bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
          <FiBriefcase className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-200">{p.name}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <FiMapPin className="h-3 w-3" /> {p.location}
          </p>
        </div>
      </div>
    )},
    { key: 'budget', label: 'Budget Line', render: (p) => (
      <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-0.5">
        <FiDollarSign className="text-slate-400" />
        {p.budget.toLocaleString()}
      </span>
    )},
    { key: 'manager', label: 'Project Manager', render: (p) => (
      <div>
        <p className="text-sm font-semibold">{p.manager?.name || 'Unassigned'}</p>
        <p className="text-[10px] text-slate-400">{p.manager?.email || ''}</p>
      </div>
    )},
    { key: 'status', label: 'Status', render: (p) => {
      let colors = 'bg-slate-50 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400';
      if (p.status === 'Active') colors = 'bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/10 dark:text-brand-primaryHover';
      if (p.status === 'Completed') colors = 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400';
      if (p.status === 'On Hold') colors = 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400';
      return (
        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg ${colors}`}>
          {p.status}
        </span>
      );
    }},
    ...(isAdmin ? [{
      key: 'actions',
      label: 'Actions',
      render: (p) => (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenEdit(p)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            title="Edit Project"
          >
            <FiEdit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(p._id)}
            className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            title="Delete Project"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }] : [])
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="bf-page-title">Project Directory</h1>
          <p className="bf-page-subtitle">
            Browse corporate project budgets, track manager assignments, and monitor active site statuses.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primaryHover shadow-md transition-all self-start sm:self-auto"
          >
            <FiPlus className="h-5 w-5" />
            Add Project
          </button>
        )}
      </div>

      {/* Filter panel */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-brand-card dark:bg-brand-darkCard border border-brand-border dark:border-brand-darkBorder p-4 rounded-card shadow-bf-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search by project name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-brand-border dark:border-brand-darkBorder rounded-xl bg-slate-50 outline-none focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 text-sm transition-all"
          />
        </form>

        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-brand-border dark:border-brand-darkBorder rounded-xl bg-slate-50 outline-none text-sm focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <Table
        headers={headers}
        data={projects}
        loading={loading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (p) => setCurrentPage(p)
        }}
      />

      {/* Create / Edit Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProject ? 'Edit Project Details' : 'Add New Project'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Project Name</label>
            <input
              type="text"
              placeholder="e.g. Skyline Residency"
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.name ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card`}
              {...register('name', { required: 'Project name is required' })}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Project Location</label>
            <input
              type="text"
              placeholder="e.g. Sector 5, Downtown"
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.location ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card`}
              {...register('location', { required: 'Location is required' })}
            />
            {errors.location && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.location.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Total Budget ($)</label>
            <input
              type="number"
              placeholder="e.g. 500000"
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.budget ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card`}
              {...register('budget', { required: 'Budget is required', min: { value: 0, message: 'Budget must be positive' } })}
            />
            {errors.budget && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.budget.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Assigned Project Manager</label>
            <select
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.manager ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card`}
              {...register('manager', { required: 'Please assign a project manager' })}
            >
              <option value="">Select Manager</option>
              {managers.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
            {errors.manager && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.manager.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Status</label>
            <select
              className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card"
              {...register('status')}
            >
              <option value="Pending">Pending</option>
              <option value="Active">Active</option>
              {editingProject && (
                <>
                  <option value="Completed">Completed</option>
                  <option value="On Hold">On Hold</option>
                </>
              )}
            </select>
          </div>

          <button
            type="submit"
            disabled={formSubmitting}
            className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {formSubmitting ? 'Saving…' : editingProject ? 'Save Changes' : 'Create Project'}
          </button>
        </form>
      </Modal>

    </div>
  );
};

export default Projects;
