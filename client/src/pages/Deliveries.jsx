import React, { useState, useEffect, useLayoutEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import {
  FiTruck,
  FiPlus,
  FiMapPin,
  FiClock,
  FiCalendar,
  FiUser,
  FiCheckCircle,
  FiUpload,
  FiDownload,
  FiAlertCircle,
  FiTrash2,
  FiList,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import { mediaUrl, openUploadedFile } from '../utils/mediaUrl';
import { pageCache } from '../utils/pageCache';
import { sortByPoNumberDesc } from '../utils/sortPo';

const getTodayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const monthBounds = (monthDate) => {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  return { fromDate: toYMD(start), toDate: toYMD(end) };
};

const Deliveries = () => {
  const { user } = useAuth();
  const isProc = user?.role === 'Procurement Officer' || user?.role === 'Administrator';
  const isDriver = user?.role === 'Delivery Staff' || user?.role === 'Administrator';
  const isSiteEng = user?.role === 'Site Engineer' || user?.role === 'Administrator';
  const todayMin = getTodayLocal();

  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [acceptedPOs, setAcceptedPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState('list'); // list | calendar
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calendarDeliveries, setCalendarDeliveries] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  // Modals
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [updatingDelivery, setUpdatingDelivery] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('Scheduled');

  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [noteDelivery, setNoteDelivery] = useState(null);
  const [noteFileObj, setNoteFileObj] = useState(null);
  const [noteUploading, setNoteUploading] = useState(false);

  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleDelivery, setRescheduleDelivery] = useState(null);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors }
  } = useForm();

  const {
    register: registerReschedule,
    handleSubmit: handleRescheduleSubmit,
    reset: resetReschedule,
    formState: { errors: rescheduleErrors }
  } = useForm();

  const watchDriver = watch('driver');
  const watchPurchaseOrder = watch('purchaseOrder');

  const getRequiredDateYmd = (poId) => {
    const selected = acceptedPOs.find((o) => o._id === poId);
    const required = selected?.materialRequest?.requiredDate;
    if (!required) return '';
    return typeof required === 'string' ? required.split('T')[0] : toYMD(new Date(required));
  };

  const formatDisplayDate = (ymd) => {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) return ymd;
    return new Date(y, m - 1, d).toLocaleDateString();
  };

  // Lock vehicle fields to the selected driver's registered profile
  useEffect(() => {
    if (!watchDriver) {
      setValue('vehicle', '');
      setValue('vehicleType', '');
      setValue('vehicleModel', '');
      return;
    }
    const selected = drivers.find((d) => d._id === watchDriver);
    if (selected) {
      setValue('vehicle', selected.vehiclePlateCode || '');
      setValue('vehicleType', selected.vehicleType || '');
      setValue('vehicleModel', selected.vehicleModel || '');
    }
  }, [watchDriver, drivers, setValue]);

  // Clear manually entered date when PO changes (user must re-enter a valid date)
  useEffect(() => {
    setValue('deliveryDate', '');
  }, [watchPurchaseOrder, setValue]);

  const fetchDeliveries = async ({ soft = false } = {}) => {
    const key = `deliveries:list:poDesc:${currentPage}:${statusFilter || ''}`;
    const cached = pageCache.get(key);
    if (cached && !soft) {
      setDeliveries(cached.deliveries);
      setTotalPages(cached.totalPages);
      setLoading(false);
    } else if (!cached?.deliveries?.length) {
      setLoading(true);
    }

    try {
      const res = await axios.get('/api/deliveries', {
        params: {
          page: currentPage,
          status: statusFilter
        }
      });
      if (res.data.success) {
        const sorted = sortByPoNumberDesc(
          res.data.deliveries,
          (d) => d?.purchaseOrder?.purchaseOrderNumber
        );
        setDeliveries(sorted);
        setTotalPages(res.data.totalPages);
        pageCache.set(key, {
          deliveries: sorted,
          totalPages: res.data.totalPages
        });
      }
    } catch (err) {
      toast.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarDeliveries = async ({ soft = false } = {}) => {
    const { fromDate, toDate } = monthBounds(calendarMonth);
    const key = `deliveries:cal:${fromDate}:${toDate}:${statusFilter || ''}`;
    const cached = pageCache.get(key);
    if (cached && !soft) {
      setCalendarDeliveries(cached);
      setCalendarLoading(false);
    } else if (!cached?.length) {
      setCalendarLoading(true);
    }

    try {
      const res = await axios.get('/api/deliveries', {
        params: {
          page: 1,
          limit: 200,
          fromDate,
          toDate,
          status: statusFilter || undefined
        }
      });
      if (res.data.success) {
        const sorted = sortByPoNumberDesc(
          res.data.deliveries,
          (d) => d?.purchaseOrder?.purchaseOrderNumber
        );
        setCalendarDeliveries(sorted);
        pageCache.set(key, sorted);
      }
    } catch (err) {
      toast.error('Failed to load calendar deliveries');
    } finally {
      setCalendarLoading(false);
    }
  };

  const fetchSchedulingResources = async () => {
    const cached = pageCache.get('deliveries:resources:poDesc');
    if (cached) {
      setDrivers(cached.drivers);
      setAcceptedPOs(cached.acceptedPOs);
      return;
    }
    try {
      const usersRes = await axios.get('/api/users', { params: { limit: 100 } });
      let driversList = [];
      if (usersRes.data.success) {
        driversList = usersRes.data.users.filter(u => u.role === 'Delivery Staff');
        setDrivers(driversList);
      }

      const poRes = await axios.get('/api/orders', { params: { status: 'Accepted', limit: 100 } });
      let accepted = [];
      if (poRes.data.success) {
        accepted = sortByPoNumberDesc(poRes.data.orders);
        setAcceptedPOs(accepted);
      }
      pageCache.set('deliveries:resources:poDesc', { drivers: driversList, acceptedPOs: accepted });
    } catch (err) {
      console.error(err);
    }
  };

  useLayoutEffect(() => {
    if (viewMode === 'list') fetchDeliveries();
  }, [currentPage, statusFilter, viewMode]);

  useLayoutEffect(() => {
    if (viewMode === 'calendar') fetchCalendarDeliveries();
  }, [calendarMonth, statusFilter, viewMode]);

  const refreshDeliveries = () => {
    pageCache.invalidate('deliveries:');
    if (viewMode === 'calendar') fetchCalendarDeliveries({ soft: true });
    else fetchDeliveries({ soft: true });
  };

  useEffect(() => {
    if (isProc) {
      fetchSchedulingResources();
    }
  }, [isProc]);

  const handleOpenSchedule = () => {
    fetchSchedulingResources(); // Refresh dropdown lists
    reset({
      purchaseOrder: '',
      driver: '',
      vehicle: '',
      vehicleType: '',
      vehicleModel: '',
      deliveryAddress: '',
      deliveryDate: '',
      timeSlot: '9 AM - 12 PM'
    });
    setIsScheduleOpen(true);
  };

  const handleOpenStatus = (delivery) => {
    setUpdatingDelivery(delivery);
    setSelectedStatus(delivery.status);
    setIsStatusOpen(true);
  };

  const handleOpenNote = (delivery) => {
    setNoteDelivery(delivery);
    setNoteFileObj(null);
    setIsNoteOpen(true);
  };

  const handleOpenReschedule = (delivery) => {
    setRescheduleDelivery(delivery);
    const current = delivery.deliveryDate
      ? toYMD(new Date(delivery.deliveryDate))
      : todayMin;
    resetReschedule({
      newDeliveryDate: current,
      timeSlot: delivery.timeSlot || '9 AM - 12 PM',
      reason: ''
    });
    setIsRescheduleOpen(true);
  };

  const onRescheduleSubmit = async (data) => {
    if (rescheduleSubmitting) return;
    setRescheduleSubmitting(true);
    try {
      const res = await axios.put(`/api/deliveries/${rescheduleDelivery._id}/reschedule`, {
        newDeliveryDate: data.newDeliveryDate,
        timeSlot: data.timeSlot,
        reason: data.reason
      });
      if (res.data.success) {
        toast.success('Delivery rescheduled successfully');
        setIsRescheduleOpen(false);
        refreshDeliveries();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reschedule delivery');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const onScheduleSubmit = async (data) => {
    if (scheduleSubmitting) return;
    setScheduleSubmitting(true);
    try {
      const res = await axios.post('/api/deliveries', data);
      if (res.data.success) {
        toast.success('Delivery scheduled successfully! Driver notified.');
        setIsScheduleOpen(false);
        refreshDeliveries();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to schedule delivery');
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const postStatusUpdate = async () => {
    if (statusSubmitting) return;
    setStatusSubmitting(true);
    try {
      const res = await axios.put(`/api/deliveries/${updatingDelivery._id}/status`, { status: selectedStatus });
      if (res.data.success) {
        toast.success(`Delivery status updated to ${selectedStatus}`);
        setIsStatusOpen(false);
        refreshDeliveries();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update delivery status');
    } finally {
      setStatusSubmitting(false);
    }
  };

  const onNoteSubmit = async (e) => {
    e.preventDefault();
    if (noteUploading) return;
    if (!noteFileObj) {
      toast.error('Please choose a file (PDF, JPG, PNG, or DOCX)');
      return;
    }
    setNoteUploading(true);
    try {
      const form = new FormData();
      form.append('deliveryNote', noteFileObj);
      const res = await axios.put(`/api/deliveries/${noteDelivery._id}/note`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        toast.success('Signed delivery note uploaded successfully.');
        setIsNoteOpen(false);
        setNoteFileObj(null);
        refreshDeliveries();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload note');
    } finally {
      setNoteUploading(false);
    }
  };

  const handleDeleteDelivery = async (delivery) => {
    const poNum = delivery.purchaseOrder?.purchaseOrderNumber || 'this delivery';
    if (!window.confirm(`Delete delivery for ${poNum}?`)) return;
    try {
      const res = await axios.delete(`/api/deliveries/${delivery._id}`);
      if (res.data.success) {
        toast.success('Delivery deleted');
        refreshDeliveries();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete delivery');
    }
  };

  const formatVehicle = (d) => {
    const parts = [
      d.vehicleType || d.driver?.vehicleType,
      d.vehicleModel || d.driver?.vehicleModel,
      d.vehicle || d.driver?.vehiclePlateCode
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' — ') : '—';
  };

  const headers = [
    { key: 'po', label: 'PO Details', render: (d) => (
      <div>
        <p className="font-bold text-slate-800 dark:text-slate-200">
          {d.purchaseOrder?.purchaseOrderNumber}
        </p>
        <p className="text-[10px] text-slate-500">
          {(d.purchaseOrder?.items || []).length > 0
            ? (d.purchaseOrder.items || [])
                .map((it) => `${it?.quantity} x ${it?.material?.name || 'Material'}`)
                .join(', ')
            : 'No items'}
        </p>
      </div>
    )},
    { key: 'supplier', label: 'Supplier', render: (d) => (
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {d.purchaseOrder?.supplier?.company || '—'}
        </p>
        <p className="text-[10px] text-slate-400">
          Rep: {d.purchaseOrder?.supplier?.name || '—'}
        </p>
      </div>
    )},
    { key: 'destination', label: 'Destination Site', render: (d) => (
      <div>
        <p className="font-bold text-slate-800 dark:text-slate-200">
          {d.purchaseOrder?.materialRequest?.project?.name || 'Central warehouse'}
        </p>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <FiMapPin className="text-slate-400 shrink-0" /> {d.deliveryAddress}
        </p>
      </div>
    )},
    { key: 'schedule', label: 'Scheduled Time', render: (d) => (
      <div className="text-xs">
        <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <FiCalendar className="text-slate-400" /> {new Date(d.deliveryDate).toLocaleDateString()}
        </p>
        <p className="text-slate-500 flex items-center gap-1 mt-0.5">
          <FiClock className="text-slate-400" /> {d.timeSlot}
        </p>
      </div>
    )},
    { key: 'scheduledBy', label: 'Scheduled By', render: (d) => (
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {d.scheduledBy?.name || '—'}
        </p>
        <p className="text-[10px] text-slate-400">{d.scheduledBy?.role || ''}</p>
      </div>
    )},
    { key: 'actual', label: 'Actual Delivery', render: (d) => (
      d.actualDeliveredAt ? (
        <div className="text-xs">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            {new Date(d.actualDeliveredAt).toLocaleDateString()}
          </p>
          <p className="text-slate-500">
            {new Date(d.actualDeliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ) : (
        <span className="text-xs text-slate-400">Not delivered</span>
      )
    )},
    { key: 'driver', label: 'Driver / Vehicle', render: (d) => (
      <div>
        <p className="text-sm font-semibold">{d.driver?.name}</p>
        <p className="text-[10px] text-slate-400 leading-relaxed">{formatVehicle(d)}</p>
      </div>
    )},
    { key: 'status', label: 'Shipping Status', render: (d) => {
      let colors = 'bg-slate-50 text-slate-600 dark:bg-slate-850/30';
      if (d.status === 'Preparing') colors = 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400';
      if (d.status === 'Dispatched') colors = 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400';
      if (d.status === 'In Transit') colors = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400';
      if (d.status === 'Delivered') colors = 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400';
      if (d.status === 'Delayed') colors = 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400';
      return (
        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg ${colors}`}>
          {d.status}
        </span>
      );
    }},
    { key: 'note', label: 'Delivery Note', render: (d) => (
      d.deliveryNoteFile ? (
        <a
          href={mediaUrl(d.deliveryNoteFile)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            e.preventDefault();
            if (!openUploadedFile(d.deliveryNoteFile)) {
              toast.error('Delivery note not found');
            }
          }}
          className="text-brand-primary hover:text-brand-primaryHover dark:text-brand-primaryHover hover:underline flex items-center gap-1 text-xs font-semibold"
        >
          <FiDownload /> Open / Download
        </a>
      ) : (
        <span className="text-xs text-slate-400">No Note</span>
      )
    )},
    { key: 'actions', label: 'Actions', render: (d) => (
      <div className="flex items-center gap-2">
        {isDriver && (d.driver?._id === user?._id || d.driver?._id === user?.id) && (
          <>
            <button
              onClick={() => handleOpenStatus(d)}
              className="px-2.5 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-850 rounded-lg hover:bg-slate-50 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Update Status
            </button>
            <button
              onClick={() => handleOpenNote(d)}
              className="px-2.5 py-1.5 text-xs font-bold bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg shadow-sm transition-colors flex items-center gap-1"
            >
              <FiUpload /> Note
            </button>
          </>
        )}
        {isProc && (
          <>
            <button
              onClick={() => handleOpenReschedule(d)}
              className="px-2.5 py-1.5 text-xs font-bold border border-brand-primary/30 text-brand-primary dark:border-teal-800 dark:text-brand-primaryHover rounded-lg hover:bg-teal-50 dark:hover:bg-brand-primary/10 transition-colors flex items-center gap-1"
              title="Reschedule Delivery"
            >
              <FiCalendar /> Reschedule
            </button>
            <button
              onClick={() => handleDeleteDelivery(d)}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
              title="Delete Delivery"
            >
              <FiTrash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    )}
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="bf-page-title">Delivery Shipments</h1>
          <p className="bf-page-subtitle">
            Schedule logistics dispatch timelines, monitor driver updates, and confirm site arrivals.
          </p>
        </div>
        {isProc && (
          <button
            onClick={handleOpenSchedule}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primaryHover shadow-md transition-all self-start sm:self-auto"
          >
            <FiPlus className="h-5 w-5" />
            Schedule Delivery
          </button>
        )}
      </div>

      {/* Filter panel */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-brand-card dark:bg-brand-darkCard border border-brand-border dark:border-brand-darkBorder p-4 rounded-card shadow-bf-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-brand-border dark:border-brand-darkBorder rounded-xl bg-slate-50 outline-none text-sm focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 text-slate-600 dark:text-slate-400"
          >
            <option value="">All Shipping Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Preparing">Preparing</option>
            <option value="Dispatched">Dispatched</option>
            <option value="In Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
            <option value="Delayed">Delayed</option>
            <option value="Rescheduled">Rescheduled</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div className="inline-flex rounded-xl border border-brand-border dark:border-brand-darkBorder p-1 bg-slate-50 dark:bg-slate-950">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'list'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FiList /> List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'calendar'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FiCalendar /> Calendar
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <Table
          headers={headers}
          data={deliveries}
          loading={loading}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: (p) => setCurrentPage(p)
          }}
        />
      ) : (
        <DeliveryCalendarPanel
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          deliveries={calendarDeliveries}
          loading={calendarLoading}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          isProc={isProc}
          onReschedule={handleOpenReschedule}
        />
      )}

      {/* Schedule Delivery Modal */}
      <Modal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        title="Schedule Shipment Dispatch"
      >
        <form onSubmit={handleSubmit(onScheduleSubmit)} className="space-y-4 py-2">
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Select Accepted PO</label>
            <select
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.purchaseOrder ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
              {...register('purchaseOrder', { required: 'Please select PO' })}
            >
              <option value="">Select PO</option>
              {acceptedPOs.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.purchaseOrderNumber} - {o.supplier?.company} (
                  {(o.items || [])
                    .map((it) => `${it?.quantity} x ${it?.material?.name || 'Material'}`)
                    .join(', ') || 'No items'}
                  )
                </option>
              ))}
            </select>
            {errors.purchaseOrder && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.purchaseOrder.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Assign Driver</label>
              <select
                className={`w-full mt-1.5 px-4 py-2.5 border ${
                  errors.driver ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
                {...register('driver', { required: 'Please assign a driver' })}
              >
                <option value="">Select Driver</option>
                {drivers.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                    {d.vehiclePlateCode ? ` (${d.vehiclePlateCode})` : ''}
                  </option>
                ))}
              </select>
              {errors.driver && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.driver.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Vehicle Plate Code</label>
              <input
                type="text"
                readOnly
                placeholder="Select a driver first"
                className={`w-full mt-1.5 px-4 py-2 border ${
                  errors.vehicle ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                } bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl text-sm outline-none cursor-not-allowed`}
                {...register('vehicle', {
                  required: 'Selected driver has no registered vehicle plate'
                })}
              />
              {errors.vehicle && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.vehicle.message}</p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">Locked to driver profile — cannot be changed here.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Delivery Date</label>
              <input
                type="date"
                min={todayMin}
                max={getRequiredDateYmd(watchPurchaseOrder) || undefined}
                className={`w-full mt-1.5 px-4 py-2 border ${
                  errors.deliveryDate ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
                {...register('deliveryDate', {
                  required: 'Please enter the delivery date',
                  validate: (value) => {
                    if (!value) return 'Please enter the delivery date';
                    if (value < todayMin) return 'Cannot select a past date';
                    const requiredYmd = getRequiredDateYmd(watchPurchaseOrder);
                    if (!requiredYmd) {
                      return 'Selected PO has no required date from Site Engineer';
                    }
                    if (value > requiredYmd) {
                      return `Taariikhda waa in ay ahaato ${formatDisplayDate(requiredYmd)} ama ka hor. Lama dooran karo taariikh ka dambeeya.`;
                    }
                    return true;
                  }
                })}
              />
              {errors.deliveryDate && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.deliveryDate.message}</p>
              )}
              {watchPurchaseOrder && getRequiredDateYmd(watchPurchaseOrder) && !errors.deliveryDate && (
                <p className="mt-1 text-[11px] text-slate-400">
                  Allowed on or before Site Engineer required date: {formatDisplayDate(getRequiredDateYmd(watchPurchaseOrder))}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Time Slot</label>
              <select
                className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                {...register('timeSlot')}
              >
                <option value="9 AM - 12 PM">9 AM - 12 PM</option>
                <option value="12 PM - 3 PM">12 PM - 3 PM</option>
                <option value="3 PM - 6 PM">3 PM - 6 PM</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Delivery Destination Address</label>
            <input
              type="text"
              placeholder="e.g. Building B, Main Street"
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.deliveryAddress ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
              {...register('deliveryAddress', { required: 'Destination is required' })}
            />
            {errors.deliveryAddress && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.deliveryAddress.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={scheduleSubmitting}
            className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scheduleSubmitting ? 'Saving…' : 'Dispatch & Notify Driver'}
          </button>
        </form>
      </Modal>

      {/* Driver Update Status Modal */}
      <Modal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        title={`Update Shipment Status for PO ${updatingDelivery?.purchaseOrder?.purchaseOrderNumber}`}
      >
        {updatingDelivery && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Update the current tracking state of this delivery.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Tracking Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
              >
                <option value="Preparing">Preparing Cargo</option>
                <option value="Dispatched">Dispatched / Left Depot</option>
                <option value="In Transit">In Transit</option>
                <option value="Delivered">Delivered successfully</option>
                <option value="Delayed">Delayed</option>
              </select>
            </div>
            {selectedStatus === 'Delivered' && (
              <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 dark:border-slate-800 dark:bg-slate-950/40 p-3 flex gap-2 text-brand-primary dark:text-brand-primaryHover text-xs leading-relaxed font-semibold">
                <FiAlertCircle className="h-5 w-5 shrink-0" />
                <span>
                  Confirming "Delivered" will automatically add these materials to site inventory and increment stock quantities.
                </span>
              </div>
            )}
            <button
              onClick={postStatusUpdate}
              disabled={statusSubmitting}
              className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {statusSubmitting ? 'Saving…' : 'Post Tracking Update'}
            </button>
          </div>
        )}
      </Modal>

      {/* Driver Upload Note Modal — Feature 10.10 */}
      <Modal
        isOpen={isNoteOpen}
        onClose={() => !noteUploading && setIsNoteOpen(false)}
        title={`Upload Delivery Note for PO ${noteDelivery?.purchaseOrder?.purchaseOrderNumber}`}
      >
        {noteDelivery && (
          <form onSubmit={onNoteSubmit} className="space-y-4 py-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Upload the signed customer delivery note / proof of delivery.
              Supported: <strong>PDF, JPG, PNG, DOCX</strong> (max 5MB).
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Delivery Note Document</label>
              <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-brand-primary hover:bg-brand-primary/5 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-brand-primary dark:hover:bg-brand-primary/10">
                <FiUpload className="h-6 w-6 text-brand-primary dark:text-brand-primaryHover" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                  {noteFileObj ? noteFileObj.name : 'Click to choose delivery note'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  PDF, JPG, PNG, or DOCX · max 5MB
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setNoteFileObj(e.target.files?.[0] || null)}
                  className="sr-only"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={noteUploading}
              className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <FiUpload /> {noteUploading ? 'Uploading…' : 'Post Delivery Note'}
            </button>
          </form>
        )}
      </Modal>

      {/* Reschedule Delivery Modal */}
      <Modal
        isOpen={isRescheduleOpen}
        onClose={() => !rescheduleSubmitting && setIsRescheduleOpen(false)}
        title={`Reschedule Delivery — ${rescheduleDelivery?.purchaseOrder?.purchaseOrderNumber || ''}`}
      >
        {rescheduleDelivery && (
          <form onSubmit={handleRescheduleSubmit(onRescheduleSubmit)} className="space-y-4 py-2">
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3 text-xs space-y-1">
              <p className="font-bold text-slate-400 uppercase">Current schedule</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {new Date(rescheduleDelivery.deliveryDate).toLocaleDateString()} · {rescheduleDelivery.timeSlot}
              </p>
              {rescheduleDelivery.originalDeliveryDate && (
                <p className="text-slate-500">
                  Original date: {new Date(rescheduleDelivery.originalDeliveryDate).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">New Delivery Date</label>
                <input
                  type="date"
                  min={todayMin}
                  className={`w-full mt-1.5 px-4 py-2 border ${
                    rescheduleErrors.newDeliveryDate ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                  } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
                  {...registerReschedule('newDeliveryDate', {
                    required: 'Required',
                    validate: (v) => !v || v >= todayMin || 'Cannot select a past date'
                  })}
                />
                {rescheduleErrors.newDeliveryDate && (
                  <p className="mt-1 text-xs text-red-500 font-semibold">{rescheduleErrors.newDeliveryDate.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Time Slot</label>
                <select
                  className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                  {...registerReschedule('timeSlot')}
                >
                  <option value="9 AM - 12 PM">9 AM - 12 PM</option>
                  <option value="12 PM - 3 PM">12 PM - 3 PM</option>
                  <option value="3 PM - 6 PM">3 PM - 6 PM</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Reason for Rescheduling</label>
              <textarea
                rows={3}
                placeholder="e.g. Supplier delay, site access, weather…"
                className={`w-full mt-1.5 px-4 py-2.5 border ${
                  rescheduleErrors.reason ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
                {...registerReschedule('reason', { required: 'Reason is required' })}
              />
              {rescheduleErrors.reason && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{rescheduleErrors.reason.message}</p>
              )}
            </div>

            {Array.isArray(rescheduleDelivery.rescheduleHistory) &&
              rescheduleDelivery.rescheduleHistory.length > 0 && (
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 space-y-2 max-h-36 overflow-y-auto">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Reschedule history</p>
                  {[...rescheduleDelivery.rescheduleHistory].reverse().map((h, i) => (
                    <div key={h._id || i} className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">
                        {new Date(h.originalDate).toLocaleDateString()} → {new Date(h.newDate).toLocaleDateString()}
                      </p>
                      <p>{h.reason}</p>
                      <p>
                        By {h.changedBy?.name || '—'} · {h.changedAt ? new Date(h.changedAt).toLocaleString() : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

            <button
              type="submit"
              disabled={rescheduleSubmitting}
              className="w-full mt-2 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors"
            >
              {rescheduleSubmitting ? 'Saving…' : 'Confirm Reschedule'}
            </button>
          </form>
        )}
      </Modal>

    </div>
  );
};

function DeliveryCalendarPanel({
  month,
  onMonthChange,
  deliveries,
  loading,
  selectedDay,
  onSelectDay,
  isProc,
  onReschedule
}) {
  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDow = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const todayStr = getTodayLocal();

  const byDay = {};
  deliveries.forEach((d) => {
    const key = toYMD(new Date(d.deliveryDate));
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(d);
  });

  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  const selectedKey = selectedDay || null;
  const dayDeliveries = selectedKey ? byDay[selectedKey] || [] : [];
  const overlapDays = Object.keys(byDay).filter((k) => byDay[k].length > 1);

  return (
    <div className="space-y-4">
      <div className="bg-brand-card dark:bg-brand-darkCard border border-brand-border dark:border-brand-darkBorder rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => onMonthChange(new Date(year, mon - 1, 1))}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600"
          >
            <FiChevronLeft />
          </button>
          <h3 className="font-extrabold text-slate-900 dark:text-white">
            {month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </h3>
          <button
            type="button"
            onClick={() => onMonthChange(new Date(year, mon + 1, 1))}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600"
          >
            <FiChevronRight />
          </button>
        </div>

        {overlapDays.length > 0 && (
          <p className="mb-3 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <FiAlertCircle /> {overlapDays.length} day(s) have overlapping deliveries — review planning.
          </p>
        )}

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm font-semibold text-slate-400">Loading calendar…</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (day == null) return <div key={`e-${idx}`} className="min-h-[72px]" />;
              const key = toYMD(new Date(year, mon, day));
              const count = byDay[key]?.length || 0;
              const isToday = key === todayStr;
              const isSelected = key === selectedKey;
              const overlap = count > 1;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => onSelectDay(key)}
                  className={`min-h-[72px] rounded-xl border p-1.5 text-left transition-colors ${
                    isSelected
                      ? 'border-brand-primary bg-brand-primary/10 dark:bg-brand-primary/10'
                      : overlap
                        ? 'border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                        : 'border-slate-100 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700'
                  } ${isToday ? 'ring-1 ring-teal-500/40' : ''}`}
                >
                  <span className={`text-xs font-bold ${isToday ? 'text-brand-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                    {day}
                  </span>
                  {count > 0 && (
                    <span className={`mt-1 block text-[10px] font-bold rounded-md px-1 py-0.5 w-fit ${
                      overlap
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300'
                    }`}>
                      {count} deliv.
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-brand-card dark:bg-brand-darkCard border border-brand-border dark:border-brand-darkBorder rounded-2xl p-4 shadow-sm">
        <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-3">
          {selectedKey
            ? `Deliveries on ${new Date(selectedKey + 'T12:00:00').toLocaleDateString()}`
            : 'Select a day to view deliveries'}
        </h4>
        {!selectedKey ? (
          <p className="text-sm text-slate-400">Click a date on the calendar.</p>
        ) : dayDeliveries.length === 0 ? (
          <p className="text-sm text-slate-400">No deliveries scheduled this day.</p>
        ) : (
          <ul className="space-y-2">
            {dayDeliveries.map((d) => (
              <li
                key={d._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 p-3"
              >
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    {d.purchaseOrder?.purchaseOrderNumber} · {d.timeSlot}
                  </p>
                  <p className="text-xs text-slate-500">
                    {d.driver?.name} · {d.deliveryAddress}
                  </p>
                  <p className="text-[10px] font-semibold text-brand-primary mt-0.5">{d.status}</p>
                </div>
                {isProc && d.status !== 'Delivered' && d.status !== 'Cancelled' && (
                  <button
                    type="button"
                    onClick={() => onReschedule(d)}
                    className="px-2.5 py-1.5 text-xs font-bold bg-brand-primary text-white rounded-lg"
                  >
                    Reschedule
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Deliveries;
