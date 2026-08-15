import React, { useState, useEffect, useLayoutEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import { FiPlus, FiLayers, FiSearch, FiEdit, FiTrash2 } from 'react-icons/fi';
import { pageCache } from '../utils/pageCache';

const Categories = () => {
  const { user } = useAuth();
  const hasAccess = user?.role === 'Administrator' || user?.role === 'Procurement Officer';

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors }
  } = useForm();

  const fetchCategories = async ({ soft = false } = {}) => {
    const key = `categories:${currentPage}:${search || ''}`;
    const cached = pageCache.get(key);
    if (cached && !soft) {
      setCategories(cached.categories);
      setTotalPages(cached.totalPages);
      setLoading(false);
    } else if (!cached?.categories?.length) {
      setLoading(true);
    }

    try {
      const res = await axios.get('/api/categories', {
        params: {
          page: currentPage,
          search
        }
      });
      if (res.data.success) {
        setCategories(res.data.categories);
        setTotalPages(res.data.totalPages);
        pageCache.set(key, {
          categories: res.data.categories,
          totalPages: res.data.totalPages
        });
      }
    } catch (err) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useLayoutEffect(() => {
    fetchCategories();
  }, [currentPage]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchCategories();
  };

  const handleOpenCreate = () => {
    setEditingCategory(null);
    reset({
      name: '',
      description: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category) => {
    setEditingCategory(category);
    reset({
      name: category.name,
      description: category.description
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      const res = await axios.delete(`/api/categories/${id}`);
      if (res.data.success) {
        toast.success('Category deleted successfully');
        pageCache.invalidate('categories:');
        fetchCategories({ soft: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete category');
    }
  };

  const onSubmit = async (data) => {
    if (formSubmitting) return;
    setFormSubmitting(true);
    try {
      if (editingCategory) {
        const res = await axios.put(`/api/categories/${editingCategory._id}`, data);
        if (res.data.success) {
          toast.success('Category updated successfully');
          setIsModalOpen(false);
          pageCache.invalidate('categories:');
          fetchCategories({ soft: true });
        }
      } else {
        const res = await axios.post('/api/categories', data);
        if (res.data.success) {
          toast.success('Category created successfully');
          setIsModalOpen(false);
          pageCache.invalidate('categories:');
          fetchCategories({ soft: true });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save category');
    } finally {
      setFormSubmitting(false);
    }
  };

  const headers = [
    { key: 'name', label: 'Category Name', render: (c) => (
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-brand-primary/10 dark:bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
          <FiLayers className="h-5 w-5" />
        </div>
        <span className="font-bold text-slate-800 dark:text-slate-200">{c.name}</span>
      </div>
    )},
    { key: 'description', label: 'Description', render: (c) => (
      <p className="text-xs text-slate-500 max-w-sm truncate leading-relaxed" title={c.description}>
        {c.description}
      </p>
    )},
    { key: 'createdAt', label: 'Created On', render: (c) => new Date(c.createdAt).toLocaleDateString() },
    ...(hasAccess ? [{
      key: 'actions',
      label: 'Actions',
      render: (c) => (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenEdit(c)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            title="Edit Category"
          >
            <FiEdit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(c._id)}
            className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            title="Delete Category"
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
          <h1 className="bf-page-title">Material Categories</h1>
          <p className="bf-page-subtitle">
            Configure system categories to organize construction stock item classifications.
          </p>
        </div>
        {hasAccess && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primaryHover shadow-md transition-all self-start sm:self-auto"
          >
            <FiPlus className="h-5 w-5" />
            Add Category
          </button>
        )}
      </div>

      {/* Filter Panel */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-brand-card dark:bg-brand-darkCard border border-brand-border dark:border-brand-darkBorder p-4 rounded-card shadow-bf-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search by category name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-brand-border dark:border-brand-darkBorder rounded-xl bg-slate-50 outline-none focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 text-sm transition-all"
          />
        </form>
      </div>

      {/* Table */}
      <Table
        headers={headers}
        data={categories}
        loading={loading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (p) => setCurrentPage(p)
        }}
      />

      {/* Create / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Create Material Category'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Category Name</label>
            <input
              type="text"
              placeholder="e.g. Structural Concrete"
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.name ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card`}
              {...register('name', { required: 'Category name is required' })}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Description</label>
            <textarea
              rows="4"
              placeholder="e.g. Cement, gravel mixes, reinforcement bars and components..."
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.description ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card`}
              {...register('description', { required: 'Description is required' })}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.description.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={formSubmitting}
            className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {formSubmitting ? 'Saving…' : editingCategory ? 'Save Changes' : 'Create Category'}
          </button>
        </form>
      </Modal>

    </div>
  );
};

export default Categories;
