import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import { FiPlus, FiTruck, FiSearch, FiEdit, FiTrash2, FiStar, FiMail, FiPhone, FiMapPin } from 'react-icons/fi';

const Suppliers = () => {
  const { user } = useAuth();
  const hasAccess = user?.role === 'Administrator' || user?.role === 'Procurement Officer';

  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedCats, setSelectedCats] = useState([]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors }
  } = useForm();

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/suppliers', {
        params: {
          page: currentPage,
          search,
          category: categoryFilter
        }
      });
      if (res.data.success) {
        setSuppliers(res.data.suppliers);
        setTotalPages(res.data.totalPages);
      }
    } catch (err) {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/categories', { params: { limit: 100 } });
      if (res.data.success) {
        setCategories(res.data.categories);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [currentPage, categoryFilter]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchSuppliers();
  };

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setSelectedCats([]);
    reset({
      name: '',
      company: '',
      phone: '',
      email: '',
      password: '',
      address: '',
      paymentTerms: 'Net 30',
      performanceRating: 5
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (supplier) => {
    setEditingSupplier(supplier);
    setSelectedCats(supplier.suppliedCategories?.map(c => c._id) || []);
    reset({
      name: supplier.name,
      company: supplier.company,
      phone: supplier.phone,
      email: supplier.email,
      password: '',
      address: supplier.address,
      paymentTerms: supplier.paymentTerms,
      performanceRating: supplier.performanceRating
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;
    try {
      const res = await axios.delete(`/api/suppliers/${id}`);
      if (res.data.success) {
        toast.success('Supplier deleted successfully');
        fetchSuppliers();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete supplier');
    }
  };

  const handleCatCheckbox = (catId) => {
    setSelectedCats(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const onSubmit = async (data) => {
    if (selectedCats.length === 0) {
      toast.error('Please select at least one supplied category');
      return;
    }
    const postData = { ...data, suppliedCategories: selectedCats };

    try {
      if (editingSupplier) {
        const res = await axios.put(`/api/suppliers/${editingSupplier._id}`, postData);
        if (res.data.success) {
          toast.success('Supplier profile updated');
          setIsModalOpen(false);
          fetchSuppliers();
        }
      } else {
        const res = await axios.post('/api/suppliers', postData);
        if (res.data.success) {
          toast.success('Supplier created — login account added under Users');
          setIsModalOpen(false);
          fetchSuppliers();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save supplier');
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex text-amber-500 gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <FiStar key={i} className={`h-4 w-4 ${i < rating ? 'fill-current' : 'text-slate-200 dark:text-slate-800'}`} />
        ))}
      </div>
    );
  };

  const headers = [
    { key: 'company', label: 'Supplier Company', render: (s) => (
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-teal-50 dark:bg-teal-950/30 text-teal-700 flex items-center justify-center shrink-0">
          <FiTruck className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug">{s.company}</p>
          <p className="text-xs text-slate-500">Contact: {s.name}</p>
        </div>
      </div>
    )},
    { key: 'contact', label: 'Contact details', render: (s) => (
      <div className="text-xs space-y-1">
        <p className="flex items-center gap-1.5"><FiMail className="text-slate-400" /> {s.email}</p>
        <p className="flex items-center gap-1.5"><FiPhone className="text-slate-400" /> {s.phone}</p>
      </div>
    )},
    { key: 'suppliedCategories', label: 'Categories Supplied', render: (s) => (
      <div className="flex flex-wrap gap-1 max-w-xs">
        {s.suppliedCategories?.map(c => (
          <span key={c._id} className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
            {c.name}
          </span>
        ))}
      </div>
    )},
    { key: 'paymentTerms', label: 'Terms', render: (s) => (
      <span className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 rounded-lg">
        {s.paymentTerms}
      </span>
    )},
    { key: 'performanceRating', label: 'Rating', render: (s) => renderStars(s.performanceRating) },
    ...(hasAccess ? [{
      key: 'actions',
      label: 'Actions',
      render: (s) => (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenEdit(s)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            title="Edit Supplier"
          >
            <FiEdit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(s._id)}
            className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            title="Delete Supplier"
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
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Supplier Directory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage partner vendor data, assess performance ratings, and configure product categories.
          </p>
        </div>
        {hasAccess && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 shadow-md transition-all self-start sm:self-auto"
          >
            <FiPlus className="h-5 w-5" />
            Add Supplier
          </button>
        )}
      </div>

      {/* Filter panel */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search by company or representative..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 outline-none focus:border-teal-500 focus:bg-white dark:bg-slate-950 text-sm transition-all"
          />
        </form>

        <div className="flex gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 outline-none text-sm focus:border-teal-500 focus:bg-white dark:bg-slate-950"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <Table
        headers={headers}
        data={suppliers}
        loading={loading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (p) => setCurrentPage(p)
        }}
      />

      {/* Create / Edit Supplier Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier Profile' : 'Add New Supplier Partner'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Representative Name</label>
              <input
                type="text"
                placeholder="e.g. John Adams"
                className={`w-full mt-1.5 px-4 py-2 border ${
                  errors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white`}
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Company Name</label>
              <input
                type="text"
                placeholder="e.g. SteelCorp Ltd"
                className={`w-full mt-1.5 px-4 py-2 border ${
                  errors.company ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white`}
                {...register('company', { required: 'Company is required' })}
              />
              {errors.company && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.company.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Phone Number</label>
              <input
                type="text"
                placeholder="+1 555-0199"
                className={`w-full mt-1.5 px-4 py-2 border ${
                  errors.phone ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white`}
                {...register('phone', { required: 'Phone is required' })}
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.phone.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Email Address</label>
              <input
                type="email"
                placeholder="sales@steelcorp.com"
                className={`w-full mt-1.5 px-4 py-2 border ${
                  errors.email ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white`}
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.email.message}</p>
              )}
            </div>
          </div>

          {!editingSupplier && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Login Password</label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                className={`w-full mt-1.5 px-4 py-2 border ${
                  errors.password ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white`}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Password must be at least 6 characters' }
                })}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.password.message}</p>
              )}
              <p className="mt-1 text-[10px] text-slate-400">
                Used for supplier login. Account will also appear under Users.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Address</label>
            <input
              type="text"
              placeholder="e.g. 100 Industrial Pkwy, Suite B"
              className={`w-full mt-1.5 px-4 py-2 border ${
                errors.address ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white`}
              {...register('address', { required: 'Address is required' })}
            />
            {errors.address && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.address.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Payment Terms</label>
              <select
                className="w-full mt-1.5 px-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white"
                {...register('paymentTerms')}
              >
                <option value="Cash on Delivery">Cash on Delivery</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 60">Net 60</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Performance Rating (1-5)</label>
              <select
                className="w-full mt-1.5 px-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white"
                {...register('performanceRating')}
              >
                <option value={5}>⭐⭐⭐⭐⭐ (5)</option>
                <option value={4}>⭐⭐⭐⭐ (4)</option>
                <option value={3}>⭐⭐⭐ (3)</option>
                <option value={2}>⭐⭐ (2)</option>
                <option value={1}>⭐ (1)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Supplied Categories</label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950">
              {categories.map((c) => (
                <label key={c._id} className="flex items-center gap-2 text-xs font-medium cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedCats.includes(c._id)}
                    onChange={() => handleCatCheckbox(c._id)}
                    className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-4 bg-teal-700 hover:bg-teal-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors"
          >
            {editingSupplier ? 'Save Changes' : 'Create Supplier Partner'}
          </button>
        </form>
      </Modal>

    </div>
  );
};

export default Suppliers;
