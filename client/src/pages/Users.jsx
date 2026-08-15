import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import {
  FiUser,
  FiSearch,
  FiEdit,
  FiShield,
  FiPlus,
  FiTrash2,
  FiUserPlus
} from 'react-icons/fi';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Modal states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [updateRoleValue, setUpdateRoleValue] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [updateVehiclePlate, setUpdateVehiclePlate] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm();

  const watchRole = watch('role');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/users', {
        params: {
          page: currentPage,
          search,
          role: roleFilter
        }
      });
      if (res.data.success) {
        setUsers(res.data.users);
        setTotalPages(res.data.totalPages);
      }
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await axios.get('/api/users/roles');
      if (res.data.success) {
        setRoles(res.data.roles);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, roleFilter]);

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers();
  };

  const handleCreateSubmit = async (data) => {
    if (formSubmitting) return;
    setFormSubmitting(true);
    try {
      const res = await axios.post('/api/users', data);
      if (res.data.success) {
        toast.success('New employee user created successfully!');
        setIsCreateOpen(false);
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await axios.put(`/api/users/${user._id}/status`, { status: nextStatus });
      if (res.data.success) {
        toast.success(`User marked as ${nextStatus}`);
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      const res = await axios.delete(`/api/users/${userId}`);
      if (res.data.success) {
        toast.success('User account deleted successfully.');
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleOpenEditRole = (user) => {
    setSelectedUser(user);
    setUpdateRoleValue(user.role);
    setUpdateVehiclePlate(user.vehiclePlateCode || '');
    setIsEditOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser || roleSubmitting) return;
    if (updateRoleValue === 'Delivery Staff') {
      if (!updateVehiclePlate.trim()) {
        toast.error('Vehicle Plate Code is required for Delivery Staff');
        return;
      }
    }
    setRoleSubmitting(true);
    try {
      const res = await axios.put(`/api/users/${selectedUser._id}/role`, {
        role: updateRoleValue,
        vehiclePlateCode: updateVehiclePlate.trim()
      });
      if (res.data.success) {
        toast.success('Role updated successfully');
        setIsEditOpen(false);
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user role');
    } finally {
      setRoleSubmitting(false);
    }
  };

  const handleOpenCreate = () => {
    reset({
      name: '',
      email: '',
      password: '',
      role: 'Site Engineer',
      status: 'Active',
      vehiclePlateCode: ''
    });
    setIsCreateOpen(true);
  };

  const headers = [
    { key: 'name', label: 'User Details', render: (u) => (
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-teal-50 border border-brand-primary/30/50 dark:bg-slate-800 text-brand-primary flex items-center justify-center font-extrabold shrink-0">
          {u.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug">{u.name}</p>
          <p className="text-xs text-slate-500">{u.email}</p>
        </div>
      </div>
    )},
    { key: 'role', label: 'Enterprise Role', render: (u) => (
      <div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/10 dark:text-brand-primaryHover">
          <FiShield className="h-3.5 w-3.5" />
          {u.role}
        </span>
        {u.role === 'Delivery Staff' && u.vehiclePlateCode && (
          <p className="text-[10px] text-slate-400 mt-1">
            Plate: {u.vehiclePlateCode}
          </p>
        )}
      </div>
    )},
    { key: 'status', label: 'Account Status', render: (u) => (
      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg ${
        u.status === 'Active'
          ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
          : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
      }`}>
        {u.status}
      </span>
    )},
    { key: 'createdAt', label: 'Registered On', render: (u) => new Date(u.createdAt).toLocaleDateString() },
    { key: 'actions', label: 'Actions', render: (u) => (
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleOpenEditRole(u)}
          className="rounded-lg p-2 text-slate-550 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          title="Change User Role"
        >
          <FiEdit className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleToggleStatus(u)}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            u.status === 'Active'
              ? 'border border-red-205 text-red-600 hover:bg-red-50 dark:border-red-950 dark:hover:bg-red-950/20'
              : 'border border-green-205 text-green-600 hover:bg-green-50 dark:border-green-950 dark:hover:bg-green-950/20'
          }`}
        >
          {u.status === 'Active' ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={() => handleDeleteUser(u._id)}
          className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          title="Delete User"
        >
          <FiTrash2 className="h-4 w-4" />
        </button>
      </div>
    )}
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="bf-page-title">User Management</h1>
          <p className="bf-page-subtitle">
            Admin dashboard to manage employee accounts, configure roles, and change system access status.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primaryHover shadow-md transition-all self-start sm:self-auto"
        >
          <FiPlus className="h-5 w-5" />
          Add Employee
        </button>
      </div>

      {/* Filter panel */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-brand-card dark:bg-brand-darkCard border border-brand-border dark:border-brand-darkBorder p-4 rounded-card shadow-bf-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-brand-border dark:border-brand-darkBorder rounded-xl bg-slate-50 outline-none focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 text-sm transition-all"
          />
        </form>

        <div className="flex gap-3">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-brand-border dark:border-brand-darkBorder rounded-xl bg-slate-50 outline-none text-sm focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 text-slate-600 dark:text-slate-400"
          >
            <option value="">All Roles</option>
            {roles.map((r) => (
              <option key={r._id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <Table
        headers={headers}
        data={users}
        loading={loading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (p) => setCurrentPage(p)
        }}
      />

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New Employee"
      >
        <form onSubmit={handleSubmit(handleCreateSubmit)} className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Full Name</label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              className={`w-full mt-1.5 px-4 py-2 border ${
                errors.name ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
              {...register('name', { required: 'Full name is required' })}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Email Address</label>
            <input
              type="email"
              placeholder="name@buildflow.com"
              className={`w-full mt-1.5 px-4 py-2 border ${
                errors.email ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
              {...register('email', { required: 'Valid email is required' })}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Password</label>
            <input
              type="password"
              placeholder="••••••"
              className={`w-full mt-1.5 px-4 py-2 border ${
                errors.password ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' }
              })}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.password.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Select Role</label>
              <select
                className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                {...register('role')}
              >
                {roles.map((r) => (
                  <option key={r._id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Status</label>
              <select
                className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                {...register('status')}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {watchRole === 'Delivery Staff' && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Vehicle Plate Code</label>
              <input
                type="text"
                placeholder="e.g. TRK-4820"
                className={`w-full mt-1.5 px-4 py-2 border ${
                  errors.vehiclePlateCode ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
                {...register('vehiclePlateCode', {
                  required: watchRole === 'Delivery Staff' ? 'Vehicle Plate Code is required' : false
                })}
              />
              {errors.vehiclePlateCode && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.vehiclePlateCode.message}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={formSubmitting}
            className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiUserPlus /> {formSubmitting ? 'Saving…' : 'Add User Account'}
          </button>
        </form>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Change Role for ${selectedUser?.name}`}
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select the new system role for this user account.
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Enterprise Role</label>
            <select
              value={updateRoleValue}
              onChange={(e) => setUpdateRoleValue(e.target.value)}
              className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card"
            >
              {roles.map((r) => (
                <option key={r._id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {updateRoleValue === 'Delivery Staff' && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Vehicle Plate Code</label>
              <input
                type="text"
                value={updateVehiclePlate}
                onChange={(e) => setUpdateVehiclePlate(e.target.value)}
                placeholder="e.g. TRK-4820"
                className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
              />
            </div>
          )}

          <button
            onClick={handleSaveRole}
            disabled={roleSubmitting}
            className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {roleSubmitting ? 'Saving…' : 'Update User Role'}
          </button>
        </div>
      </Modal>

    </div>
  );
};

export default Users;
