import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import {
  FiFileText,
  FiSearch,
  FiEdit,
  FiTrash2,
  FiUpload,
  FiDownload,
  FiDollarSign
} from 'react-icons/fi';
import { mediaUrl, openUploadedFile } from '../utils/mediaUrl';

const PurchaseOrders = () => {
  const { user } = useAuth();
  const isSupplier = user?.role === 'Supplier';
  const isProc = user?.role === 'Procurement Officer' || user?.role === 'Administrator';
  const isAdmin = user?.role === 'Administrator';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [updatingOrder, setUpdatingOrder] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('Accepted');

  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoicingOrder, setInvoicingOrder] = useState(null);
  const [invoiceFileObj, setInvoiceFileObj] = useState(null);
  const [invoiceUploading, setInvoiceUploading] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm();

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors }
  } = useForm();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/orders', {
        params: {
          page: currentPage,
          search,
          status: statusFilter,
          paymentStatus: paymentFilter
        }
      });
      if (res.data.success) {
        setOrders(res.data.orders);
        setTotalPages(res.data.totalPages);
      }
    } catch (err) {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [currentPage, statusFilter, paymentFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchOrders();
  };

  const handleOpenStatus = (order) => {
    setUpdatingOrder(order);
    setSelectedStatus(order.status === 'Pending' ? 'Accepted' : order.status);
    setIsStatusOpen(true);
  };

  const handleOpenInvoice = (order) => {
    setInvoicingOrder(order);
    setInvoiceFileObj(null);
    setIsInvoiceOpen(true);
  };

  const generateInvoiceFromPO = async () => {
    if (!invoicingOrder?._id) return;
    setInvoiceUploading(true);
    try {
      const res = await axios.post(`/api/orders/${invoicingOrder._id}/generate-invoice`);
      if (res.data.success) {
        toast.success('Invoice generated from PO — ready for payment!');
        setIsInvoiceOpen(false);
        setInvoiceFileObj(null);
        fetchOrders();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate invoice');
    } finally {
      setInvoiceUploading(false);
    }
  };

  const handleOpenEdit = (order) => {
    setEditingOrder(order);
    const item = order.items?.[0];
    resetEdit({
      quantity: item?.quantity || 1,
      unitPrice: item?.unitPrice || 0,
      tax: order.tax || 0,
      discount: order.discount || 0,
      status: order.status
    });
    setIsEditOpen(true);
  };

  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`Delete purchase order ${order.purchaseOrderNumber}? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await axios.delete(`/api/orders/${order._id}`);
      if (res.data.success) {
        toast.success('Purchase order deleted');
        fetchOrders();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete purchase order');
    }
  };

  const postStatus = async () => {
    try {
      const res = await axios.put(`/api/orders/${updatingOrder._id}/status`, { status: selectedStatus });
      if (res.data.success) {
        toast.success(`Order set to ${selectedStatus}`);
        setIsStatusOpen(false);
        fetchOrders();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update order status');
    }
  };

  const onInvoiceSubmit = async (e) => {
    e.preventDefault();
    if (!invoiceFileObj) {
      toast.error('Please choose a file (PDF, JPG, PNG, or DOCX)');
      return;
    }
    setInvoiceUploading(true);
    try {
      const form = new FormData();
      form.append('invoice', invoiceFileObj);
      const res = await axios.put(`/api/orders/${invoicingOrder._id}/invoice`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        toast.success('Invoice uploaded successfully. Notification sent to Accountant.');
        setIsInvoiceOpen(false);
        setInvoiceFileObj(null);
        fetchOrders();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload invoice');
    } finally {
      setInvoiceUploading(false);
    }
  };

  const onEditSubmit = async (data) => {
    try {
      const res = await axios.put(`/api/orders/${editingOrder._id}`, {
        quantity: Number(data.quantity),
        unitPrice: Number(data.unitPrice),
        tax: Number(data.tax),
        discount: Number(data.discount),
        status: data.status
      });
      if (res.data.success) {
        toast.success('Purchase order updated');
        setIsEditOpen(false);
        fetchOrders();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update purchase order');
    }
  };

  const canSupplierAct = (o) =>
    isSupplier && o.supplier?.email === user?.email;

  const headers = [
    { key: 'poNumber', label: 'PO Details', render: (o) => (
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-brand-primary/10 dark:bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
          <FiFileText className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-200">{o.purchaseOrderNumber}</p>
          <p className="text-[10px] text-slate-500">Date: {new Date(o.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    )},
    { key: 'supplier', label: 'Supplier Company', render: (o) => (
      <div>
        <p className="text-sm font-semibold">{o.supplier?.company}</p>
        <p className="text-[10px] text-slate-400">Rep: {o.supplier?.name}</p>
      </div>
    )},
    { key: 'items', label: 'Fulfillment Items', render: (o) => {
      const item = o.items[0];
      return (
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-200">
            {item?.quantity} x {item?.material?.name}
          </p>
          <p className="text-xs text-slate-500">Unit Price: ${item?.unitPrice?.toFixed(2)}</p>
        </div>
      );
    }},
    { key: 'grandTotal', label: 'Grand Total', render: (o) => (
      <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-0.5">
        <FiDollarSign className="text-slate-400" />
        {o.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    )},
    { key: 'status', label: 'PO Status', render: (o) => {
      let colors = 'bg-slate-50 text-slate-600 dark:bg-slate-850/30';
      if (o.status === 'Accepted') colors = 'bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/10 dark:text-brand-primaryHover';
      if (o.status === 'Rejected') colors = 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400';
      if (o.status === 'Preparing') colors = 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400';
      if (o.status === 'Dispatched') colors = 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400';
      if (o.status === 'Delivered') colors = 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400';
      return (
        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg ${colors}`}>
          {o.status}
        </span>
      );
    }},
    { key: 'paymentStatus', label: 'Payment Status', render: (o) => {
      let colors = 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400';
      if (o.paymentStatus === 'Paid') colors = 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400';
      if (o.paymentStatus === 'Partially Paid') colors = 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400';
      return (
        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg ${colors}`}>
          {o.paymentStatus}
        </span>
      );
    }},
    { key: 'invoice', label: 'Invoice Doc', render: (o) => (
      o.invoiceFile ? (
        <a
          href={mediaUrl(o.invoiceFile)}
          target="_blank"
          rel="noreferrer"
          download
          onClick={(e) => {
            // Prefer opening PDF in new tab; download attr helps for non-PDF too
            e.preventDefault();
            if (!openUploadedFile(o.invoiceFile)) {
              toast.error('Invoice file not found');
            }
          }}
          className="text-brand-primary hover:text-brand-primaryHover dark:text-brand-primaryHover hover:underline flex items-center gap-1 text-xs font-semibold"
        >
          <FiDownload /> Download PDF
        </a>
      ) : (
        <span className="text-xs text-slate-400">Not Uploaded</span>
      )
    )},
    { key: 'actions', label: 'Actions', render: (o) => (
      <div className="flex items-center gap-2">
        {isProc && (
          <>
            <button
              onClick={() => handleOpenEdit(o)}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Update PO"
            >
              <FiEdit className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDeleteOrder(o)}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
              title="Delete PO"
            >
              <FiTrash2 className="h-4 w-4" />
            </button>
          </>
        )}

        {(canSupplierAct(o) || isAdmin) && (
          <>
            <button
              onClick={() => handleOpenStatus(o)}
              className="px-2.5 py-1.5 text-xs font-bold border border-brand-border dark:border-brand-darkBorder rounded-lg hover:bg-slate-50 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Update Status
            </button>
            <button
              onClick={() => handleOpenInvoice(o)}
              className="px-2.5 py-1.5 text-xs font-bold bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg shadow-sm transition-colors flex items-center gap-1"
            >
              <FiUpload /> Invoice
            </button>
          </>
        )}
      </div>
    )}
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h1 className="bf-page-title">Purchase Orders</h1>
        <p className="bf-page-subtitle">
          Monitor auto-incremented PO indexes, review fulfillment progress, and verify payment states.
        </p>
      </div>

      {/* Filter panel */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-brand-card dark:bg-brand-darkCard border border-brand-border dark:border-brand-darkBorder p-4 rounded-card shadow-bf-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search PO number (e.g. PO-2026-00001)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-brand-border dark:border-brand-darkBorder rounded-xl bg-slate-50 outline-none focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 text-sm transition-all"
          />
        </form>

        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-brand-border dark:border-brand-darkBorder rounded-xl bg-slate-50 outline-none text-sm focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 text-slate-600 dark:text-slate-400"
          >
            <option value="">All PO Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
            <option value="Preparing">Preparing</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-brand-border dark:border-brand-darkBorder rounded-xl bg-slate-50 outline-none text-sm focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 text-slate-600 dark:text-slate-400"
          >
            <option value="">All Payment Statuses</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Orders table */}
      <Table
        headers={headers}
        data={orders}
        loading={loading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (p) => setCurrentPage(p)
        }}
      />

      {/* Procurement / Admin Edit Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Update PO ${editingOrder?.purchaseOrderNumber || ''}`}
      >
        {editingOrder && (
          <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4 py-2">
            <p className="text-xs text-slate-400">
              {editingOrder.items?.[0]?.material?.name || 'Material'} — {editingOrder.supplier?.company}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Quantity</label>
                <input
                  type="number"
                  min={1}
                  className={`w-full mt-1.5 px-4 py-2 border ${
                    editErrors.quantity ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                  } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
                  {...registerEdit('quantity', {
                    required: 'Required',
                    min: { value: 1, message: 'Min 1' }
                  })}
                />
                {editErrors.quantity && (
                  <p className="mt-1 text-xs text-red-500 font-semibold">{editErrors.quantity.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Unit Price ($)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={`w-full mt-1.5 px-4 py-2 border ${
                    editErrors.unitPrice ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                  } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
                  {...registerEdit('unitPrice', {
                    required: 'Required',
                    min: { value: 0, message: 'Must be positive' }
                  })}
                />
                {editErrors.unitPrice && (
                  <p className="mt-1 text-xs text-red-500 font-semibold">{editErrors.unitPrice.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Tax ($)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                  {...registerEdit('tax')}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Discount ($)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                  {...registerEdit('discount')}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">PO Status</label>
              <select
                className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                {...registerEdit('status')}
              >
                <option value="Pending">Pending</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Preparing">Preparing</option>
                <option value="Dispatched">Dispatched</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Payment status is updated automatically when the Accountant records a payment (or when PO is cancelled).
              </p>
            </div>

            <button
              type="submit"
              className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors"
            >
              Save Changes
            </button>
          </form>
        )}
      </Modal>

      {/* Supplier Update Status Modal */}
      <Modal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        title={`Update Status for PO ${updatingOrder?.purchaseOrderNumber}`}
      >
        {updatingOrder && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select the appropriate status update for this order assignment.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Fulfillment Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
              >
                <option value="Accepted">Accept Order</option>
                <option value="Rejected">Reject Order</option>
                <option value="Preparing">Delivery Preparation</option>
                <option value="Dispatched">Dispatched / Shipped</option>
              </select>
            </div>
            <button
              onClick={postStatus}
              className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors"
            >
              Post Status Update
            </button>
          </div>
        )}
      </Modal>

      {/* Supplier Upload Invoice Modal — Feature 10.10 */}
      <Modal
        isOpen={isInvoiceOpen}
        onClose={() => !invoiceUploading && setIsInvoiceOpen(false)}
        title={`Upload Invoice for PO ${invoicingOrder?.purchaseOrderNumber}`}
      >
        {invoicingOrder && (
          <form onSubmit={onInvoiceSubmit} className="space-y-4 py-2">
            <div className="rounded-xl border border-brand-primary/30 bg-brand-primary/10 p-4 dark:border-brand-primary/40 dark:bg-brand-primary/10">
              <p className="text-sm font-bold text-brand-text dark:text-teal-300">
                Habka fudud (lagula talinayaa)
              </p>
              <p className="mt-1 text-xs text-brand-muted dark:text-teal-300/90">
                System-ku wuxuu PDF invoice ka sameynayaa xogta PO-gan — Word uma baahnid.
              </p>
              <button
                type="button"
                disabled={invoiceUploading}
                onClick={generateInvoiceFromPO}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-primaryHover disabled:opacity-50"
              >
                <FiFileText />{' '}
                {invoiceUploading ? 'Generating…' : 'Generate Invoice from PO (1 click)'}
              </button>
            </div>

            <div className="relative py-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <span className="bg-white px-2 dark:bg-slate-900">ama upload custom file</span>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Optional: upload your own invoice document.
              Supported: <strong>PDF, JPG, PNG, DOCX</strong> (max 5MB).
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Invoice Document</label>
              <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-brand-primary hover:bg-brand-primary/5 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-brand-primary dark:hover:bg-brand-primary/10">
                <FiUpload className="h-6 w-6 text-brand-primary dark:text-brand-primaryHover" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                  {invoiceFileObj ? invoiceFileObj.name : 'Click to choose invoice file'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  PDF, JPG, PNG, or DOCX · max 5MB
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setInvoiceFileObj(e.target.files?.[0] || null)}
                  className="sr-only"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={invoiceUploading || !invoiceFileObj}
              className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-1 disabled:opacity-50 dark:bg-slate-700"
            >
              <FiUpload /> {invoiceUploading ? 'Uploading…' : 'Post Custom Invoice File'}
            </button>
          </form>
        )}
      </Modal>

    </div>
  );
};

export default PurchaseOrders;
