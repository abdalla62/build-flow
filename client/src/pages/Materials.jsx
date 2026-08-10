import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import { FiPlus, FiBox, FiSearch, FiEdit, FiTrash2, FiAlertTriangle } from 'react-icons/fi';

const Materials = () => {
  const { user } = useAuth();
  const hasAccess = user?.role === 'Administrator' || user?.role === 'Procurement Officer';

  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [suppliersError, setSuppliersError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm();

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/materials', {
        params: {
          page: currentPage,
          search,
          category: categoryFilter,
          supplier: supplierFilter,
          lowStock: lowStockFilter ? 'true' : 'false'
        }
      });
      if (res.data.success) {
        setMaterials(res.data.materials);
        setTotalPages(res.data.totalPages);
      }
    } catch (err) {
      toast.error('Failed to load materials database');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const catRes = await axios.get('/api/categories', { params: { limit: 100 } });
      const supRes = await axios.get('/api/suppliers', { params: { limit: 100 } });
      if (catRes.data.success) setCategories(catRes.data.categories);
      if (supRes.data.success) setSuppliers(supRes.data.suppliers);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [currentPage, categoryFilter, supplierFilter, lowStockFilter]);

  useEffect(() => {
    fetchFilters();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchMaterials();
  };

  const handleOpenCreate = () => {
    setEditingMaterial(null);
    setSelectedSuppliers([]);
    setSuppliersError('');
    reset({
      name: '',
      category: '',
      unit: 'Bags',
      estimatedPrice: '',
      currentStock: 0,
      minimumStock: 50,
      description: '',
      status: 'Active'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (material) => {
    setEditingMaterial(material);
    const fromArray = (material.suppliers || []).map((s) => s._id || s).filter(Boolean);
    const fallback = material.supplier?._id || material.supplier;
    setSelectedSuppliers(fromArray.length > 0 ? fromArray : fallback ? [fallback] : []);
    setSuppliersError('');
    reset({
      name: material.name,
      category: material.category?._id || '',
      unit: material.unit,
      estimatedPrice: material.estimatedPrice,
      currentStock: material.currentStock,
      minimumStock: material.minimumStock,
      description: material.description,
      status: material.status
    });
    setIsModalOpen(true);
  };

  const toggleSupplier = (supplierId) => {
    setSelectedSuppliers((prev) =>
      prev.includes(supplierId)
        ? prev.filter((id) => id !== supplierId)
        : [...prev, supplierId]
    );
    setSuppliersError('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this material item?')) return;
    try {
      const res = await axios.delete(`/api/materials/${id}`);
      if (res.data.success) {
        toast.success('Material deleted successfully');
        fetchMaterials();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete material');
    }
  };

  const onSubmit = async (data) => {
    if (selectedSuppliers.length === 0) {
      setSuppliersError('Select at least one primary supplier');
      return;
    }
    setSuppliersError('');
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('category', data.category);
    formData.append('unit', data.unit);
    formData.append('estimatedPrice', data.estimatedPrice);
    formData.append('currentStock', data.currentStock ?? 0);
    formData.append('minimumStock', data.minimumStock ?? 0);
    formData.append('description', data.description || '');
    formData.append('status', data.status || 'Active');
    formData.append('suppliers', JSON.stringify(selectedSuppliers));

    try {
      if (editingMaterial) {
        const res = await axios.put(`/api/materials/${editingMaterial._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data.success) {
          toast.success('Stock item updated');
          setIsModalOpen(false);
          fetchMaterials();
        }
      } else {
        const res = await axios.post('/api/materials', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data.success) {
          toast.success('Stock item added');
          setIsModalOpen(false);
          fetchMaterials();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save material');
    }
  };

  const headers = [
    { key: 'name', label: 'Stock Name', render: (m) => (
      <div className="flex items-center gap-3">
        {m.image ? (
          <img src={m.image} alt={m.name} className="h-10 w-10 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-brand-primary/10 dark:bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
            <FiBox className="h-5 w-5" />
          </div>
        )}
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug">{m.name}</p>
          <span className="inline-block px-2 py-0.5 mt-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 rounded">
            {m.category?.name || 'No Category'}
          </span>
        </div>
      </div>
    )},
    { key: 'stock', label: 'Current Inventory', render: (m) => {
      const isLowStock = m.currentStock <= m.minimumStock;
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-slate-100">{m.currentStock} {m.unit}</span>
            {isLowStock && (
              <span className="text-red-500 dark:text-red-400 flex items-center gap-0.5 text-xs font-semibold" title="Stock alert limit reached">
                <FiAlertTriangle className="h-3.5 w-3.5" /> Low
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">Min. stock limit: {m.minimumStock} {m.unit}</p>
        </div>
      );
    }},
    { key: 'estimatedPrice', label: 'Est. Price', render: (m) => (
      <span className="font-semibold text-slate-800 dark:text-slate-200">
        ${m.estimatedPrice.toFixed(2)} / {m.unit.slice(0, -1) || 'unit'}
      </span>
    )},
    { key: 'supplier', label: 'Supplier Partner', render: (m) => {
      const list =
        m.suppliers?.length > 0
          ? m.suppliers
          : m.supplier
            ? [m.supplier]
            : [];
      if (list.length === 0) {
        return <p className="text-sm text-slate-400">None</p>;
      }
      return (
        <div className="space-y-1 max-w-[200px]">
          {list.map((s) => (
            <div key={s._id || s}>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {s.company || 'Supplier'}
              </p>
              <p className="text-[10px] text-slate-400">Rep: {s.name || ''}</p>
            </div>
          ))}
        </div>
      );
    }},
    { key: 'status', label: 'Status', render: (m) => (
      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg ${
        m.status === 'Active'
          ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
          : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
      }`}>
        {m.status}
      </span>
    )},
    ...(hasAccess ? [{
      key: 'actions',
      label: 'Actions',
      render: (m) => (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenEdit(m)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            title="Edit Material"
          >
            <FiEdit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(m._id)}
            className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            title="Delete Material"
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
          <h1 className="bf-page-title">Material Catalog</h1>
          <p className="bf-page-subtitle">
            Browse construction materials, track current inventory levels, estimated prices, and set replenishment alert flags.
          </p>
        </div>
        {hasAccess && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primaryHover shadow-md transition-all self-start sm:self-auto"
          >
            <FiPlus className="h-5 w-5" />
            Add Material
          </button>
        )}
      </div>

      {/* Filter panel */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between bg-brand-card dark:bg-brand-darkCard border border-brand-border dark:border-brand-darkBorder p-4 rounded-card shadow-bf-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search materials by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-brand-border dark:border-brand-darkBorder rounded-xl bg-slate-50 outline-none focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 text-sm transition-all"
          />
        </form>

        <div className="flex flex-wrap gap-3">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-brand-border dark:border-brand-darkBorder rounded-xl bg-slate-50 outline-none text-sm focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 text-slate-600 dark:text-slate-400"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Supplier Filter */}
          <select
            value={supplierFilter}
            onChange={(e) => {
              setSupplierFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-brand-border dark:border-brand-darkBorder rounded-xl bg-slate-50 outline-none text-sm focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 text-slate-600 dark:text-slate-400"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.company}
              </option>
            ))}
          </select>

          {/* Low Stock Toggle checkbox */}
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-brand-border dark:border-brand-darkBorder rounded-xl px-4 py-2 bg-slate-50 dark:bg-slate-950 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStockFilter}
              onChange={(e) => {
                setLowStockFilter(e.target.checked);
                setCurrentPage(1);
              }}
              className="rounded text-brand-primary focus:ring-brand-primary h-4 w-4"
            />
            <span className="flex items-center gap-1">
              <FiAlertTriangle className="text-red-500" />
              Low Stock Only
            </span>
          </label>
        </div>
      </div>

      {/* Table */}
      <Table
        headers={headers}
        data={materials}
        loading={loading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (p) => setCurrentPage(p)
        }}
      />

      {/* Create / Edit Material Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMaterial ? 'Edit Material specifications' : 'Define New Material'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Stock Name (Magaca Stock-ka)</label>
            <input
              type="text"
              placeholder="e.g. Portland Cement Grade 43"
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.name ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card`}
              {...register('name', { required: 'Stock name is required' })}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Category</label>
              <select
                className={`w-full mt-1.5 px-4 py-2.5 border ${
                  errors.category ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card`}
                {...register('category', { required: 'Please select a category' })}
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.category.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Unit of Measure</label>
              <select
                className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card"
                {...register('unit')}
              >
                <option value="Bags">Bags</option>
                <option value="Tons">Tons</option>
                <option value="Meters">Meters</option>
                <option value="Liters">Liters</option>
                <option value="Units">Units</option>
                <option value="Kilograms">Kilograms</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Est. Unit Price ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 15.50"
                className={`w-full mt-1.5 px-4 py-2 border ${
                  errors.estimatedPrice ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card`}
                {...register('estimatedPrice', { required: 'Required', min: { value: 0, message: 'Must be positive' } })}
              />
              {errors.estimatedPrice && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.estimatedPrice.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Current Stock</label>
              <input
                type="number"
                placeholder="0"
                className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card"
                {...register('currentStock', { min: { value: 0, message: 'Stock must be positive' } })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Min. Stock Alert</label>
              <input
                type="number"
                placeholder="50"
                className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card"
                {...register('minimumStock', { min: { value: 0, message: 'Must be positive' } })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">
              Primary Suppliers
            </label>
            <p className="mt-1 text-[10px] text-slate-400">Select one or more suppliers for this material.</p>
            <div
              className={`mt-1.5 max-h-36 overflow-y-auto rounded-xl border ${
                suppliersError ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 p-2 space-y-1`}
            >
              {suppliers.length === 0 ? (
                <p className="text-xs text-slate-400 px-2 py-1">No suppliers available</p>
              ) : (
                suppliers.map((s) => (
                  <label
                    key={s._id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.includes(s._id)}
                      onChange={() => toggleSupplier(s._id)}
                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-200">
                      {s.company} ({s.name})
                    </span>
                  </label>
                ))
              )}
            </div>
            {suppliersError && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{suppliersError}</p>
            )}
            {selectedSuppliers.length > 0 && (
              <p className="mt-1 text-[10px] text-brand-primary dark:text-brand-primaryHover font-medium">
                {selectedSuppliers.length} supplier{selectedSuppliers.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Status</label>
            <select
              className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card"
              {...register('status')}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Description / Specifications</label>
            <textarea
              rows="3"
              placeholder="Provide technical specifications or comments..."
              className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary focus:bg-brand-card"
              {...register('description')}
            />
          </div>

          <button
            type="submit"
            className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors"
          >
            {editingMaterial ? 'Save Changes' : 'Create Material'}
          </button>
        </form>
      </Modal>

    </div>
  );
};

export default Materials;
