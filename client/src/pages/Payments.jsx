import React, { useState, useEffect, useLayoutEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import {
  FiDollarSign,
  FiPlus,
  FiCheckCircle,
  FiCalendar,
  FiFileText,
  FiUser,
  FiInfo,
  FiSmartphone,
  FiDownload,
  FiUpload
} from 'react-icons/fi';
import { mediaUrl, openUploadedFile } from '../utils/mediaUrl';
import { pageCache } from '../utils/pageCache';
import { sortByPoNumberDesc } from '../utils/sortPo';

const Payments = () => {
  const { user } = useAuth();
  const isAccountant = user?.role === 'Accountant' || user?.role === 'Administrator';

  const [payments, setPayments] = useState([]);
  const [activePOs, setActivePOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [receiptFileObj, setReceiptFileObj] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm();

  const watchPOId = watch('purchaseOrder', '');
  const watchPaidAmt = watch('paidAmount', 0);
  const watchMethod = watch('paymentMethod', 'Mobile Wallet');

  const [poTotal, setPOTotal] = useState(0);
  const [poPaidBefore, setPOPaidBefore] = useState(0);
  const [poRemaining, setPORemaining] = useState(0);

  const fetchPayments = async ({ soft = false } = {}) => {
    const key = `payments:${currentPage}`;
    const cached = pageCache.get(key);
    if (cached && !soft) {
      setPayments(cached.payments);
      setTotalPages(cached.totalPages);
      setLoading(false);
    } else if (!cached?.payments?.length) {
      setLoading(true);
    }

    try {
      const res = await axios.get('/api/payments', { params: { page: currentPage } });
      if (res.data.success) {
        setPayments(res.data.payments);
        setTotalPages(res.data.totalPages);
        pageCache.set(key, {
          payments: res.data.payments,
          totalPages: res.data.totalPages
        });
      }
    } catch (err) {
      toast.error('Failed to load payment logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivePOs = async () => {
    const key = 'payments:activePOs:poDesc';
    const cached = pageCache.get(key);
    if (cached) {
      setActivePOs(cached);
      return;
    }
    try {
      const res = await axios.get('/api/orders', { params: { limit: 100 } });
      if (res.data.success) {
        const filterPOs = sortByPoNumberDesc(
          res.data.orders.filter(
            (o) =>
              o.paymentStatus !== 'Paid' &&
              o.paymentStatus !== 'Cancelled' &&
              o.status === 'Delivered' &&
              o.status !== 'Rejected' &&
              o.status !== 'Cancelled' &&
              Boolean(o.invoiceFile)
          )
        );
        setActivePOs(filterPOs);
        pageCache.set(key, filterPOs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useLayoutEffect(() => {
    fetchPayments();
  }, [currentPage]);

  useEffect(() => {
    if (isAccountant) {
      fetchActivePOs();
    }
  }, [isAccountant]);

  useEffect(() => {
    const checkPOBalance = async () => {
      if (!watchPOId) {
        setPOTotal(0);
        setPOPaidBefore(0);
        setPORemaining(0);
        return;
      }
      try {
        const order = activePOs.find((o) => o._id === watchPOId);
        if (order) {
          setPOTotal(order.grandTotal);
          const payRes = await axios.get('/api/payments', { params: { limit: 100 } });
          if (payRes.data.success) {
            const matches = payRes.data.payments.filter((p) => p.purchaseOrder?._id === watchPOId);
            const sumPaid = matches.reduce((sum, p) => sum + p.paidAmount, 0);
            setPOPaidBefore(sumPaid);
            setPORemaining(order.grandTotal - sumPaid);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkPOBalance();
  }, [watchPOId, activePOs]);

  const handleOpenRecord = () => {
    reset({
      purchaseOrder: '',
      paidAmount: '',
      paymentMethod: 'Mobile Wallet',
      referenceNumber: '',
      accountNo: ''
    });
    setReceiptFileObj(null);
    setPOTotal(0);
    setPOPaidBefore(0);
    setPORemaining(0);
    setIsRecordOpen(true);
  };

  /** Accept 0.01+, and treat 001 / 005 / 025 as cents → $0.01 / $0.05 / $0.25 */
  const parsePayAmount = (raw) => {
    const s = String(raw ?? '').trim();
    if (!s) return NaN;
    if (/^0\d{2}$/.test(s)) return Number(s) / 100;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const onSubmit = async (data) => {
    if (submitting) return;
    const amount = parsePayAmount(data.paidAmount);
    if (!(amount >= 0.01)) {
      toast.error('Minimum payment is (type 0.01)');
      return;
    }
    if (amount > poRemaining) {
      toast.error(`Payment cannot exceed remaining balance of $${Number(poRemaining).toFixed(2)}`);
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('purchaseOrder', data.purchaseOrder);
      form.append('paidAmount', String(Number(amount.toFixed(2))));
      form.append('paymentMethod', data.paymentMethod);

      if (data.paymentMethod === 'Mobile Wallet') {
        form.append('accountNo', data.accountNo || '');
      } else {
        form.append('referenceNumber', data.referenceNumber || '');
      }

      if (receiptFileObj) {
        form.append('receipt', receiptFileObj);
      }

      const res = await axios.post('/api/payments', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        toast.success(
          <span className="whitespace-pre-line leading-snug">
            {`$${amount.toFixed(2)} Ayaad Ku\nbixisay adeega\nJAAMACADDA\nJAMHURIYA`}
          </span>,
          { duration: 5000 }
        );
        setIsRecordOpen(false);
        setReceiptFileObj(null);
        pageCache.invalidate('payments:');
        pageCache.invalidate('orders:');
        fetchPayments({ soft: true });
        pageCache.invalidate('payments:activePOs');
        fetchActivePOs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const headers = [
    {
      key: 'po',
      label: 'Purchase Order',
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-brand-primary/10 dark:bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
            <FiFileText className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {p.purchaseOrder?.purchaseOrderNumber || 'Unlinked'}
            </p>
            <span
              className={`inline-block px-2 py-0.5 mt-0.5 text-[10px] font-bold rounded ${
                p.purchaseOrder?.paymentStatus === 'Paid'
                  ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
              }`}
            >
              {p.purchaseOrder?.paymentStatus}
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'referenceNumber',
      label: 'Reference Number',
      render: (p) => (
        <div>
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase">
            {p.referenceNumber}
          </span>
          {p.waafiTransactionId && (
            <p className="text-[10px] text-brand-primary mt-0.5">Waafi: {p.waafiTransactionId}</p>
          )}
        </div>
      )
    },
    {
      key: 'paymentMethod',
      label: 'Payment Method',
      render: (p) => (
        <div>
          <span className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
            {p.paymentMethod}
          </span>
          {p.payerAccountNo && (
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <FiSmartphone /> {p.payerAccountNo}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'amounts',
      label: 'Transaction Cost',
      render: (p) => (
        <div className="text-xs">
          <p className="font-bold text-slate-900 dark:text-slate-100">Paid: ${Number(p.paidAmount).toFixed(2)}</p>
          <p className="text-slate-400 mt-0.5">Remaining Bal: ${Number(p.remainingBalance).toFixed(2)}</p>
        </div>
      )
    },
    {
      key: 'recordedBy',
      label: 'Logged By',
      render: (p) => (
        <span className="text-xs font-semibold flex items-center gap-1">
          <FiUser className="text-slate-400" />
          {p.recordedBy?.name || 'System'}
        </span>
      )
    },
    {
      key: 'paymentDate',
      label: 'Paid On',
      render: (p) => (
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <FiCalendar /> {new Date(p.paymentDate).toLocaleDateString()}
        </span>
      )
    },
    {
      key: 'receipt',
      label: 'Receipt',
      render: (p) =>
        p.receiptFile ? (
          <a
            href={mediaUrl(p.receiptFile)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              e.preventDefault();
              if (!openUploadedFile(p.receiptFile)) {
                toast.error('Receipt file not found');
              }
            }}
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-primary dark:text-brand-primaryHover hover:underline"
          >
            <FiDownload /> View / Download
          </a>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="bf-page-title">Payment Management</h1>
          <p className="bf-page-subtitle">
            Pay delivered &amp; invoiced POs via WaafiPay mobile wallet.
          </p>
        </div>
        {isAccountant && (
          <button
            onClick={handleOpenRecord}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primaryHover shadow-md transition-all self-start sm:self-auto"
          >
            <FiPlus className="h-5 w-5" />
            Record Payment
          </button>
        )}
      </div>

      <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/10 dark:border-brand-primary/40/40 dark:bg-brand-primary/10 px-4 py-3 text-xs text-teal-800 dark:text-teal-300 space-y-1">
        <p className="font-bold flex items-center gap-1">
          <FiCheckCircle /> Payment rules
        </p>
        <p>1) Supplier must upload invoice on the PO</p>
        <p>2) Delivery must be marked Delivered</p>
        <p>3) Mobile Wallet charges the phone via WaafiPay (approve PIN on the handset)</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Ledger Statements</h3>
        <Table
          headers={headers}
          data={payments}
          loading={loading}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: (p) => setCurrentPage(p)
          }}
        />
      </div>

      <Modal isOpen={isRecordOpen} onClose={() => !submitting && setIsRecordOpen(false)} title="Record Payment Payout">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Select Purchase Order</label>
            <select
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.purchaseOrder ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
              {...register('purchaseOrder', { required: 'Please select a PO' })}
            >
              <option value="">Select PO (Delivered + Invoice)</option>
              {activePOs.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.purchaseOrderNumber} - {o.supplier?.company} (Total: ${o.grandTotal.toFixed(2)})
                </option>
              ))}
            </select>
            {errors.purchaseOrder && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.purchaseOrder.message}</p>
            )}
            {isAccountant && activePOs.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No payable POs yet. Need: invoice uploaded + status Delivered + not fully paid.
              </p>
            )}
          </div>

          {watchPOId && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40 p-4 space-y-2 text-xs">
              <span className="font-bold text-slate-400 uppercase">PO Ledger Status</span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <p className="text-slate-400">Total Price</p>
                  <p className="font-bold text-slate-800 dark:text-slate-100">${Number(poTotal).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Paid Before</p>
                  <p className="font-bold text-slate-800 dark:text-slate-100">${Number(poPaidBefore).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Outstanding Bal</p>
                  <p className="font-extrabold text-brand-primary dark:text-brand-primaryHover">${Number(poRemaining).toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Payment Method</label>
              <select
                className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                {...register('paymentMethod')}
              >
                <option value="Mobile Wallet">Mobile Wallet (WaafiPay)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Payment Amount ($)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.01"
                className={`w-full mt-1.5 px-4 py-2.5 border ${
                  errors.paidAmount ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
                {...register('paidAmount', {
                  required: 'Required',
                  validate: (v) => {
                    const n = parsePayAmount(v);
                    if (!(n >= 0.01)) return 'Minimum is $0.01 (use 0.01)';
                    if (poRemaining > 0 && n > poRemaining) {
                      return `Cannot exceed $${Number(poRemaining).toFixed(2)}`;
                    }
                    return true;
                  }
                })}
              />
              {errors.paidAmount && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.paidAmount.message}</p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Ugu Yaraan Geli $0.01 (cent) <strong></strong>  
              </p>
            </div>
          </div>

          {watchMethod === 'Mobile Wallet' ? (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Payer Mobile (EVC )</label>
              <input
                type="text"
                placeholder="+25261XXXXXXX"
                className={`w-full mt-1.5 px-4 py-2 border ${
                  errors.accountNo ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
                {...register('accountNo', {
                  required: 'Mobile account is required for WaafiPay',
                  pattern: {
                    value: /^(252)?6\d{8}$|^0?6\d{8}$/,
                    message: 'Use +25261XXXXXXX'
                  }
                })}
              />
              {errors.accountNo && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.accountNo.message}</p>
              )}
              <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                <FiSmartphone /> Fadlan Geli Telefoonka Lacagta Laga Dirayo ($0.01)
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Transaction Reference Code</label>
              <input
                type="text"
                placeholder="e.g. TXN-94920942"
                className={`w-full mt-1.5 px-4 py-2 border ${
                  errors.referenceNumber ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
                } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
                {...register('referenceNumber', {
                  required: watchMethod !== 'Mobile Wallet' ? 'Transaction reference is required' : false
                })}
              />
              {errors.referenceNumber && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.referenceNumber.message}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">
              Payment Receipt (optional)
            </label>
            <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-brand-primary hover:bg-brand-primary/5 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-brand-primary dark:hover:bg-brand-primary/10">
              <FiUpload className="h-5 w-5 text-brand-primary dark:text-brand-primaryHover" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                {receiptFileObj ? receiptFileObj.name : 'Click to choose receipt (optional)'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                PDF, JPG, PNG, or DOCX
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setReceiptFileObj(e.target.files?.[0] || null)}
                className="sr-only"
              />
            </label>
          </div>

          {(() => {
            const preview = parsePayAmount(watchPaidAmt);
            if (!(preview >= 0.01) || !(poRemaining > 0)) return null;
            return (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <FiInfo /> Amount: <strong>${preview.toFixed(2)}</strong>
                {' · '}
                New Remaining:{' '}
                <strong>${Number(poRemaining - preview).toFixed(2)}</strong>
              </div>
            );
          })()}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-1"
          >
            <FiDollarSign />
            {submitting
              ? watchMethod === 'Mobile Wallet'
                ? 'Waiting for WaafiPay / PIN…'
                : 'Saving…'
              : watchMethod === 'Mobile Wallet'
                ? 'Charge Mobile Wallet'
                : 'Post Payment Record'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Payments;
