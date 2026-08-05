import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import {
  FiPlus,
  FiClipboard,
  FiSearch,
  FiEdit,
  FiTrash2,
  FiCheckCircle,
  FiXCircle,
  FiCornerUpLeft,
  FiAlertTriangle,
  FiClock,
  FiInfo,
  FiDollarSign,
  FiUser,
  FiCalendar,
  FiX,
  FiMinus
} from 'react-icons/fi';

const getTodayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const MaterialRequests = () => {
  const { user } = useAuth();
  const isSiteEng = user?.role === 'Site Engineer' || user?.role === 'Administrator';
  const isPM = user?.role === 'Project Manager' || user?.role === 'Administrator';

  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLines, setSelectedLines] = useState([]);
  const [linesError, setLinesError] = useState('');
  const todayMin = getTodayLocal();

  // Modals
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [reviewAction, setReviewAction] = useState('Approve');
  const [reviewComments, setReviewComments] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [suppliersError, setSuppliersError] = useState('');

  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [receivingRequest, setReceivingRequest] = useState(null);
  const [damagedQuantity, setDamagedQuantity] = useState(0);
  const [damagedComments, setDamagedComments] = useState('');

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyRequest, setHistoryRequest] = useState(null);
  const [approvalHistory, setApprovalHistory] = useState([]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors }
  } = useForm();

  // Watch for cost estimation (edit mode / single material)
  const watchQty = watch('quantity', 0);
  const watchMatId = watch('material', '');
  const [selectedMaterialPrice, setSelectedMaterialPrice] = useState(0);
  const [selectedMaterialUnit, setSelectedMaterialUnit] = useState('units');

  useEffect(() => {
    if (watchMatId) {
      const mat = materials.find(m => m._id === watchMatId);
      if (mat) {
        setSelectedMaterialPrice(mat.estimatedPrice);
        setSelectedMaterialUnit(mat.unit);
      }
    }
  }, [watchMatId, materials]);

  const multiEstTotal = selectedLines.reduce((sum, line) => {
    const mat = materials.find((m) => m._id === line.materialId);
    const price = mat?.estimatedPrice || 0;
    const qty = Number(line.quantity) || 0;
    return sum + qty * price;
  }, 0);

  const handleAddMaterialLine = (e) => {
    const materialId = e.target.value;
    if (!materialId) return;
    setSelectedLines((prev) => {
      if (prev.some((l) => l.materialId === materialId)) return prev;
      return [...prev, { materialId, quantity: 1 }];
    });
    setLinesError('');
    e.target.value = '';
  };

  const handleLineQuantityChange = (materialId, quantity) => {
    setSelectedLines((prev) =>
      prev.map((l) => (l.materialId === materialId ? { ...l, quantity } : l))
    );
  };

  const handleRemoveLine = (materialId) => {
    setSelectedLines((prev) => prev.filter((l) => l.materialId !== materialId));
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/requests', {
        params: {
          page: currentPage,
          status: statusFilter,
          priority: priorityFilter
        }
      });
      if (res.data.success) {
        setRequests(res.data.requests);
        setTotalPages(res.data.totalPages);
      }
    } catch (err) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      const projRes = await axios.get('/api/projects', { params: { limit: 100 } });
      const matRes = await axios.get('/api/materials', { params: { limit: 100 } });
      const supRes = await axios.get('/api/suppliers', { params: { limit: 100 } });
      if (projRes.data.success) setProjects(projRes.data.projects);
      if (matRes.data.success) setMaterials(matRes.data.materials);
      if (supRes.data.success) setSuppliers(supRes.data.suppliers);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [currentPage, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchResources();
  }, []);

  const handleOpenSubmit = () => {
    setEditingRequest(null);
    setSelectedMaterialPrice(0);
    setSelectedMaterialUnit('units');
    setSelectedLines([]);
    setLinesError('');
    reset({
      project: '',
      material: '',
      quantity: 1,
      priority: 'Medium',
      reason: '',
      requiredDate: ''
    });
    setIsSubmitOpen(true);
  };

  const handleOpenEdit = (request) => {
    setEditingRequest(request);
    setSelectedLines([]);
    setLinesError('');
    reset({
      project: request.project?._id || '',
      material: request.material?._id || '',
      quantity: request.quantity,
      priority: request.priority,
      reason: request.reason,
      requiredDate: request.requiredDate ? request.requiredDate.split('T')[0] : ''
    });
    setIsSubmitOpen(true);
  };

  const handleCancelRequest = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    try {
      const res = await axios.delete(`/api/requests/${id}`);
      if (res.data.success) {
        toast.success('Request cancelled successfully');
        fetchRequests();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel request');
    }
  };

  const toggleSupplier = (supplierId) => {
    setSelectedSuppliers((prev) =>
      prev.includes(supplierId)
        ? prev.filter((id) => id !== supplierId)
        : [...prev, supplierId]
    );
    setSuppliersError('');
  };

  const handleOpenReview = (request) => {
    setReviewingRequest(request);
    setReviewComments('');
    setReviewAction('Approve');
    setSelectedSuppliers(
      (request.suppliers || []).map((s) => s._id || s).filter(Boolean)
    );
    setSuppliersError('');
    setIsReviewOpen(true);
  };

  const handleOpenReceive = (request) => {
    setReceivingRequest(request);
    setDamagedQuantity(0);
    setDamagedComments('');
    setIsReceiveOpen(true);
  };

  const handleOpenHistory = async (request) => {
    setHistoryRequest(request);
    try {
      const res = await axios.get(`/api/requests/${request._id}`);
      if (res.data.success) {
        setApprovalHistory(res.data.approvals);
        setIsHistoryOpen(true);
      }
    } catch (err) {
      toast.error('Failed to load approval logs');
    }
  };

  const onFormSubmit = async (data) => {
    try {
      if (editingRequest) {
        const res = await axios.put(`/api/requests/${editingRequest._id}`, data);
        if (res.data.success) {
          toast.success('Request resubmitted successfully');
          setIsSubmitOpen(false);
          fetchRequests();
        }
      } else {
        if (selectedLines.length === 0) {
          setLinesError('Please select at least one material');
          return;
        }
        const invalidQty = selectedLines.some((l) => !l.quantity || Number(l.quantity) < 1);
        if (invalidQty) {
          setLinesError('Each material quantity must be at least 1');
          return;
        }
        setLinesError('');
        const shared = {
          project: data.project,
          priority: data.priority,
          reason: data.reason,
          requiredDate: data.requiredDate
        };
        await Promise.all(
          selectedLines.map((line) =>
            axios.post('/api/requests', {
              ...shared,
              material: line.materialId,
              quantity: Number(line.quantity)
            })
          )
        );
        toast.success(
          selectedLines.length === 1
            ? 'Material request submitted'
            : `${selectedLines.length} material requests submitted`
        );
        setIsSubmitOpen(false);
        setSelectedLines([]);
        fetchRequests();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit request');
    }
  };

  const postReview = async () => {
    try {
      if (reviewAction === 'Approve' && selectedSuppliers.length === 0) {
        setSuppliersError('Select at least one supplier for quotations');
        return;
      }
      setSuppliersError('');
      const payload = {
        action: reviewAction,
        comments: reviewComments
      };
      if (selectedSuppliers.length > 0) {
        payload.suppliers = selectedSuppliers;
      }
      const res = await axios.put(`/api/requests/${reviewingRequest._id}/review`, payload);
      if (res.data.success) {
        toast.success(`Request successfully ${reviewAction.toLowerCase()}d`);
        setIsReviewOpen(false);
        fetchRequests();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to review request');
    }
  };

  const postReceive = async () => {
    try {
      const res = await axios.put(`/api/requests/${receivingRequest._id}/receive`, {
        damagedQuantity,
        comments: damagedComments
      });
      if (res.data.success) {
        toast.success('Materials marked as Received');
        setIsReceiveOpen(false);
        fetchRequests();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to confirm receipt');
    }
  };

  // PM budget warning calculation
  const getBudgetReviewDetails = () => {
    if (!reviewingRequest) return null;
    const reqCost = reviewingRequest.quantity * (reviewingRequest.material?.estimatedPrice || 0);
    const budget = reviewingRequest.project?.budget || 0;
    const limitWarning = reqCost > budget * 0.20;

    return {
      cost: reqCost,
      budget,
      limitWarning
    };
  };

  const budgetDetails = getBudgetReviewDetails();

  const headers = [
    { key: 'project', label: 'Project details', render: (r) => (
      <div>
        <p className="font-bold text-slate-800 dark:text-slate-200">{r.project?.name || 'Unlinked'}</p>
        <p className="text-[10px] text-slate-500">{r.project?.location || ''}</p>
      </div>
    )},
    { key: 'material', label: 'Material items', render: (r) => (
      <div>
        <p className="font-bold text-slate-800 dark:text-slate-200">
          {r.quantity} {r.material?.unit}
        </p>
        <p className="text-xs text-slate-500">{r.material?.name || 'Unknown'}</p>
      </div>
    )},
    { key: 'estCost', label: 'Est. Cost', render: (r) => (
      <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-0.5">
        <FiDollarSign className="text-slate-400" />
        {(r.quantity * (r.material?.estimatedPrice || 0)).toLocaleString()}
      </span>
    )},
    { key: 'priority', label: 'Priority', render: (r) => {
      let colors = 'bg-slate-100 text-slate-600 dark:bg-slate-800/40';
      if (r.priority === 'High') colors = 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400';
      if (r.priority === 'Urgent') colors = 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded ${colors}`}>
          {r.priority}
        </span>
      );
    }},
    { key: 'status', label: 'Request Status', render: (r) => {
      let colors = 'bg-slate-50 text-slate-600 dark:bg-slate-800/40';
      if (r.status === 'Approved') colors = 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400';
      if (r.status === 'Returned') colors = 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400';
      if (r.status === 'Rejected') colors = 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400';
      if (r.status === 'Ordered') colors = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400';
      if (r.status === 'Delivered') colors = 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400';
      return (
        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg ${colors}`}>
          {r.status}
        </span>
      );
    }},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-2">
        {/* Site Engineer actions */}
        {isSiteEng && (r.requestedBy?._id === user?._id || r.requestedBy?._id === user?.id) && (
          <>
            {['Pending', 'Returned'].includes(r.status) && (
              <>
                <button
                  onClick={() => handleOpenEdit(r)}
                  className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Modify / Resubmit"
                >
                  <FiEdit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleCancelRequest(r._id)}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                  title="Cancel Request"
                >
                  <FiXCircle className="h-4 w-4" />
                </button>
              </>
            )}
            {r.status === 'Ordered' && (
              <button
                onClick={() => handleOpenReceive(r)}
                className="px-2.5 py-1.5 text-xs font-bold bg-green-700 hover:bg-green-600 text-white rounded-lg shadow-sm transition-colors"
              >
                Confirm Receipt
              </button>
            )}
          </>
        )}

        {/* Project Manager review / edit actions */}
        {isPM && ['Pending', 'Returned', 'Rejected'].includes(r.status) && (
          <>
            <button
              onClick={() => handleOpenReview(r)}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Edit / Review"
            >
              <FiEdit className="h-4 w-4" />
            </button>
            {r.status === 'Pending' && (
              <button
                onClick={() => handleOpenReview(r)}
                className="px-2.5 py-1.5 text-xs font-bold bg-teal-700 hover:bg-teal-600 text-white rounded-lg shadow-sm transition-colors"
              >
                Review Request
              </button>
            )}
          </>
        )}

        {/* Timeline Log History */}
        <button
          onClick={() => handleOpenHistory(r)}
          className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="View Approval History"
        >
          <FiClock className="h-4 w-4" />
        </button>
      </div>
    )}
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Material Requests</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Submit material orders, review remaining budgets, and complete approvals workflow.
          </p>
        </div>
        {isSiteEng && (
          <button
            onClick={handleOpenSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 shadow-md transition-all self-start sm:self-auto"
          >
            <FiPlus className="h-5 w-5" />
            Request Material
          </button>
        )}
      </div>

      {/* Filter panel */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 outline-none text-sm focus:border-teal-500 focus:bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Returned">Returned</option>
            <option value="Ordered">Ordered</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 outline-none text-sm focus:border-teal-500 focus:bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400"
          >
            <option value="">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Requests table */}
      <Table
        headers={headers}
        data={requests}
        loading={loading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (p) => setCurrentPage(p)
        }}
      />

      {/* Create / Edit Request Modal */}
      <Modal
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        title={editingRequest ? 'Edit Returned Request' : 'Submit Material Request'}
      >
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Target Project</label>
            <select
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.project ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white`}
              {...register('project', { required: 'Project selection is required' })}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.project && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.project.message}</p>
            )}
          </div>

          {editingRequest ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase">Material Item</label>
                  <select
                    className={`w-full mt-1.5 px-4 py-2.5 border ${
                      errors.material ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                    } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white`}
                    {...register('material', { required: 'Please select material' })}
                  >
                    <option value="">Select Material</option>
                    {materials.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {errors.material && (
                    <p className="mt-1 text-xs text-red-500 font-semibold">{errors.material.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase">Quantity ({selectedMaterialUnit})</label>
                  <input
                    type="number"
                    placeholder="1"
                    className={`w-full mt-1.5 px-4 py-2 border ${
                      errors.quantity ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                    } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white`}
                    {...register('quantity', { required: 'Required', min: { value: 1, message: 'Must be at least 1' } })}
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-xs text-red-500 font-semibold">{errors.quantity.message}</p>
                  )}
                </div>
              </div>

              {watchQty > 0 && selectedMaterialPrice > 0 && (
                <div className="rounded-xl border border-teal-100 bg-teal-50/20 dark:border-slate-800 dark:bg-slate-950/40 p-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                    <FiInfo /> Estimated unit price index: ${selectedMaterialPrice}
                  </span>
                  <span className="text-sm font-extrabold text-teal-600 dark:text-teal-400">
                    Est. Total: ${(watchQty * selectedMaterialPrice).toLocaleString()}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Material Item</label>
                <select
                  className={`w-full mt-1.5 px-4 py-2.5 border ${
                    linesError ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                  } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white`}
                  defaultValue=""
                  onChange={handleAddMaterialLine}
                >
                  <option value="">Select Material</option>
                  {materials
                    .filter((m) => !selectedLines.some((l) => l.materialId === m._id))
                    .map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name}
                      </option>
                    ))}
                </select>
                {linesError && (
                  <p className="mt-1 text-xs text-red-500 font-semibold">{linesError}</p>
                )}
              </div>

              {selectedLines.length > 0 && (
                <div className="space-y-2">
                  {selectedLines.map((line) => {
                    const mat = materials.find((m) => m._id === line.materialId);
                    return (
                      <div
                        key={line.materialId}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {mat?.name || 'Material'}
                          </p>
                          <p className="text-[10px] text-slate-400 uppercase">
                            {mat?.unit || 'units'} · ${mat?.estimatedPrice || 0}/unit
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleLineQuantityChange(
                                line.materialId,
                                Math.max(1, Number(line.quantity) - 1)
                              )
                            }
                            disabled={Number(line.quantity) <= 1}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <FiMinus size={14} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) =>
                              handleLineQuantityChange(line.materialId, e.target.value)
                            }
                            className="w-12 px-1 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-sm text-center outline-none focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            aria-label={`Quantity for ${mat?.name || 'material'}`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleLineQuantityChange(
                                line.materialId,
                                Number(line.quantity) + 1
                              )
                            }
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-teal-500 transition-colors"
                            aria-label="Increase quantity"
                          >
                            <FiPlus size={14} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.materialId)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                          aria-label="Remove material"
                        >
                          <FiX size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedLines.length > 0 && multiEstTotal > 0 && (
                <div className="rounded-xl border border-teal-100 bg-teal-50/20 dark:border-slate-800 dark:bg-slate-950/40 p-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                    <FiInfo /> {selectedLines.length} item{selectedLines.length > 1 ? 's' : ''} selected
                  </span>
                  <span className="text-sm font-extrabold text-teal-600 dark:text-teal-400">
                    Est. Total: ${multiEstTotal.toLocaleString()}
                  </span>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Priority</label>
              <select
                className="w-full mt-1.5 px-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white"
                {...register('priority')}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Required By Date</label>
              <div className="relative mt-1.5">
                <input
                  type="date"
                  min={todayMin}
                  className={`w-full px-4 py-2 pr-10 border ${
                    errors.requiredDate ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                  } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white`}
                  {...register('requiredDate', {
                    required: 'Required Date is required',
                    validate: (value) =>
                      !value || value >= todayMin || 'Cannot select a past date'
                  })}
                />
                <FiCalendar
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300"
                  size={16}
                />
              </div>
              {errors.requiredDate && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.requiredDate.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Reason / Notes</label>
            <textarea
              rows="3"
              placeholder="e.g. Needed for concrete pouring on slab C..."
              className={`w-full mt-1.5 px-4 py-2 border ${
                errors.reason ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white`}
              {...register('reason', { required: 'Reason is required' })}
            />
            {errors.reason && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.reason.message}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full mt-4 bg-teal-700 hover:bg-teal-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors"
          >
            {editingRequest ? 'Resubmit Request' : 'Submit Request'}
          </button>
        </form>
      </Modal>

      {/* Review Request Modal (for PM) */}
      <Modal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        title="Review Material Request"
      >
        {reviewingRequest && budgetDetails && (
          <div className="space-y-4 py-2">
            
            {/* Request Summary */}
            <div className="bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-850 p-4 rounded-xl space-y-2">
              <p className="text-xs text-slate-400 font-bold uppercase">Requested details</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {reviewingRequest.quantity} {reviewingRequest.material?.unit} of {reviewingRequest.material?.name}
              </p>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Project: {reviewingRequest.project?.name} | Reason: "{reviewingRequest.reason}"
              </p>
            </div>

            {/* PM multi-supplier invite for quotations */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">
                Invite Suppliers (Quotations)
              </label>
              <p className="mt-1 text-[10px] text-slate-400">
                Select one or more suppliers who can submit quotation bids. Required when approving.
              </p>
              <div
                className={`mt-1.5 max-h-40 overflow-y-auto rounded-xl border ${
                  suppliersError ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
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
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200">
                        {s.company || s.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {suppliersError && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{suppliersError}</p>
              )}
              {selectedSuppliers.length > 0 && (
                <p className="mt-1 text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                  {selectedSuppliers.length} supplier{selectedSuppliers.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Budget warning checks */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Estimated request cost</span>
                <p className="text-base font-extrabold text-slate-900 dark:text-white mt-1">${budgetDetails.cost.toLocaleString()}</p>
              </div>
              <div className="border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Project Budget</span>
                <p className="text-base font-extrabold text-slate-900 dark:text-white mt-1">${budgetDetails.budget.toLocaleString()}</p>
              </div>
            </div>

            {budgetDetails.limitWarning && (
              <div className="rounded-xl border border-red-100 bg-red-50/20 dark:border-red-950/40 p-3 flex gap-2 text-red-600 dark:text-red-400">
                <FiAlertTriangle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase">Budget Warning Alert</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed font-semibold">
                    The requested cost exceeds 20% of the project's total designated budget. Ensure sufficient contingency exists before approval.
                  </p>
                </div>
              </div>
            )}

            {/* Decision inputs — dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Review Action</label>
              <select
                value={reviewAction}
                onChange={(e) => setReviewAction(e.target.value)}
                className="w-full mt-1.5 px-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white"
              >
                <option value="Approve">Approve</option>
                <option value="Return">Return</option>
                <option value="Reject">Reject</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Remarks / Justification comments</label>
              <textarea
                rows="3"
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder="Include details about budget approval status or reason for returning..."
                className="w-full mt-1.5 px-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500 focus:bg-white"
              />
            </div>

            <button
              onClick={postReview}
              className="w-full mt-4 bg-teal-700 hover:bg-teal-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors"
            >
              Post Review Decision
            </button>
          </div>
        )}
      </Modal>

      {/* Confirm Receipt Modal (for Site Engineer) */}
      <Modal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        title="Confirm Materials Receipt"
      >
        {receivingRequest && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Confirm quantities of received materials on site. Report if any item arrived damaged or broken.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Total Requested</label>
                <input
                  type="text"
                  disabled
                  value={`${receivingRequest.quantity} ${receivingRequest.material?.unit}`}
                  className="w-full mt-1.5 px-4 py-2.5 border border-slate-200 bg-slate-100 rounded-xl text-sm text-slate-500 dark:border-slate-850 dark:bg-slate-950/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Damaged Quantity</label>
                <input
                  type="number"
                  value={damagedQuantity}
                  onChange={(e) => setDamagedQuantity(Number(e.target.value))}
                  placeholder="0"
                  className="w-full mt-1.5 px-4 py-2 border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {damagedQuantity > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Damaged Materials Notes</label>
                <textarea
                  rows="3"
                  value={damagedComments}
                  onChange={(e) => setDamagedComments(e.target.value)}
                  placeholder="Describe the nature of the damaged stock..."
                  className="w-full mt-1.5 px-4 py-2 border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500"
                />
              </div>
            )}

            <button
              onClick={postReceive}
              className="w-full mt-4 bg-green-700 hover:bg-green-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors"
            >
              Sign Delivery Receipt
            </button>
          </div>
        )}
      </Modal>

      {/* View Timeline History Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Approval Timeline Logs"
      >
        {historyRequest && (
          <div className="space-y-6 py-2">
            
            {/* Requester Info */}
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
                <FiUser />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-white">Submitted by {historyRequest.requestedBy?.name}</p>
                <p className="text-xs text-slate-400">{new Date(historyRequest.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {/* Approval Steps list */}
            {approvalHistory.length === 0 ? (
              <p className="text-center py-6 text-sm text-slate-400 font-medium">No review cycles completed yet.</p>
            ) : (
              <div className="space-y-4">
                {approvalHistory.map((step) => {
                  let badge = 'bg-slate-50 text-slate-600 dark:bg-slate-850/30';
                  if (step.action === 'Approve') badge = 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400';
                  if (step.action === 'Reject') badge = 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400';
                  if (step.action === 'Return') badge = 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400';

                  return (
                    <div key={step._id} className="p-3.5 border border-slate-100 dark:border-slate-850 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {step.approver?.name} ({step.approver?.role})
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${badge}`}>
                          {step.action}d
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-50 dark:border-slate-800/40 italic">
                        "{step.comments}"
                      </p>
                      <p className="text-[10px] text-slate-400 text-right">
                        {new Date(step.createdAt).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Damaged Report Info */}
            {historyRequest.damagedReported && historyRequest.damagedReported.quantity > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/20 dark:border-slate-850 dark:bg-slate-950/30 p-3.5 space-y-1 text-amber-800 dark:text-amber-400">
                <div className="flex items-center gap-1 text-xs font-bold">
                  <FiAlertTriangle /> Damaged Stock Delivery Report
                </div>
                <p className="text-xs font-semibold">
                  Reported: {historyRequest.damagedReported.quantity} {historyRequest.material?.unit} damaged.
                </p>
                <p className="text-xs italic text-slate-500 mt-1">
                  Note: "{historyRequest.damagedReported.comments}"
                </p>
              </div>
            )}

          </div>
        )}
      </Modal>

    </div>
  );
};

export default MaterialRequests;
