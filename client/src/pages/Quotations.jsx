import React, { useState, useEffect, useLayoutEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import {
  FiTrendingDown,
  FiClock,
  FiStar,
  FiAward
} from 'react-icons/fi';
import { pageCache } from '../utils/pageCache';

const requestLines = (r) =>
  Array.isArray(r?.lines) && r.lines.length > 0 ? r.lines : r ? [r] : [];

const lineId = (line) => String(line?._id || line?.id || '');

const requestIdOfQuote = (q) =>
  String(q?.materialRequest?._id || q?.materialRequest || '');

const Quotations = () => {
  const { user } = useAuth();
  const isSupplier = user?.role === 'Supplier' || user?.role === 'Administrator';
  const isProc = user?.role === 'Procurement Officer' || user?.role === 'Administrator';

  const [approvedRequests, setApprovedRequests] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isBidOpen, setIsBidOpen] = useState(false);
  const [biddingRequest, setBiddingRequest] = useState(null);
  const [linePrices, setLinePrices] = useState({});
  const [deliveryCost, setDeliveryCost] = useState('50');
  const [deliveryTimeDays, setDeliveryTimeDays] = useState('3');
  const [warrantyMonths, setWarrantyMonths] = useState('12');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [awardSubmitting, setAwardSubmitting] = useState(false);
  const [editingBid, setEditingBid] = useState(false);

  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [comparingRequest, setComparingRequest] = useState(null);
  const [compareQuotes, setCompareQuotes] = useState([]);

  const fetchApprovedRequests = async ({ soft = false } = {}) => {
    const key = 'quotations:approved';
    const cached = pageCache.get(key);
    if (cached && !soft) {
      setApprovedRequests(cached);
      setLoading(false);
    } else if (!cached?.length) {
      setLoading(true);
    }

    try {
      const res = await axios.get('/api/requests', {
        params: { status: 'Approved', limit: 100, grouped: true }
      });
      if (res.data.success) {
        setApprovedRequests(res.data.requests);
        pageCache.set(key, res.data.requests);
      }
    } catch (err) {
      toast.error('Failed to load approved requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotations = async ({ soft = false } = {}) => {
    const key = 'quotations:list';
    const cached = pageCache.get(key);
    if (cached && !soft) {
      setQuotations(cached);
    }

    try {
      const res = await axios.get('/api/quotations');
      if (res.data.success) {
        setQuotations(res.data.quotations);
        pageCache.set(key, res.data.quotations);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useLayoutEffect(() => {
    fetchApprovedRequests();
    fetchQuotations();
  }, []);

  const refreshQuotes = () => {
    pageCache.invalidate('quotations:');
    fetchApprovedRequests({ soft: true });
    fetchQuotations({ soft: true });
  };

  const quotesFor = (request) => {
    const ids = new Set(requestLines(request).map(lineId).filter(Boolean));
    return quotations.filter((q) => ids.has(requestIdOfQuote(q)));
  };

  const bidCount = (request) => {
    const suppliers = new Set(
      quotesFor(request).map((q) => String(q.supplier?._id || q.supplier || ''))
    );
    suppliers.delete('');
    return suppliers.size;
  };

  const myPendingQuotesFor = (request) => {
    if (user?.role !== 'Supplier') return [];
    // getQuotations already scopes to this supplier login
    return quotesFor(request).filter((q) => q.status === 'Pending');
  };

  const handleOpenBid = (request, edit = false) => {
    const lines = requestLines(request);
    const mine = myPendingQuotesFor(request);
    const prices = {};
    lines.forEach((line) => {
      const existing = mine.find((q) => requestIdOfQuote(q) === lineId(line));
      prices[lineId(line)] =
        existing?.unitPrice ?? line.material?.estimatedPrice ?? '';
    });
    setLinePrices(prices);
    const first = mine[0];
    setDeliveryCost(String(first?.deliveryCost ?? '50'));
    setDeliveryTimeDays(String(first?.deliveryTimeDays ?? '3'));
    setWarrantyMonths(String(first?.warrantyMonths ?? '12'));
    setPaymentTerms(first?.paymentTerms || 'Net 30');
    setEditingBid(Boolean(edit && mine.length > 0));
    setBiddingRequest(request);
    setIsBidOpen(true);
  };

  const handleOpenCompare = async (request) => {
    setComparingRequest(request);
    try {
      const res = await axios.get('/api/quotations', { params: { requestId: request._id } });
      if (res.data.success) {
        setCompareQuotes(res.data.quotations);
        setIsCompareOpen(true);
      }
    } catch (err) {
      toast.error('Failed to load comparative quotes');
    }
  };

  const onBidSubmit = async (e) => {
    e.preventDefault();
    if (bidSubmitting) return;
    const lines = requestLines(biddingRequest);
    const items = [];
    for (const line of lines) {
      const price = Number(linePrices[lineId(line)]);
      if (Number.isNaN(price) || price < 0) {
        toast.error('Enter a unit price for every material');
        return;
      }
      items.push({ materialRequest: line._id, unitPrice: price });
    }
    const ship = Number(deliveryCost);
    const days = Number(deliveryTimeDays);
    if (Number.isNaN(ship) || ship < 0 || Number.isNaN(days) || days < 1) {
      toast.error('Enter valid delivery cost and time');
      return;
    }

    setBidSubmitting(true);
    try {
      const payload = {
        materialRequest: biddingRequest._id,
        items,
        deliveryCost: ship,
        deliveryTimeDays: days,
        warrantyMonths: Number(warrantyMonths) || 0,
        paymentTerms
      };
      const res = editingBid
        ? await axios.put('/api/quotations/batch', payload)
        : await axios.post('/api/quotations/batch', payload);
      if (res.data.success) {
        toast.success(
          editingBid ? 'Bid updated successfully!' : 'Bid quotation submitted successfully!'
        );
        setIsBidOpen(false);
        setEditingBid(false);
        pageCache.invalidate('quotations:');
        fetchQuotations({ soft: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save bid');
    } finally {
      setBidSubmitting(false);
    }
  };

  const handleAwardContract = async (quoteId) => {
    if (awardSubmitting) return;
    if (!window.confirm('Are you sure you want to select this quotation and generate a Purchase Order?')) return;
    setAwardSubmitting(true);
    try {
      const res = await axios.put(`/api/quotations/${quoteId}/select`);
      if (res.data.success) {
        toast.success('Contract awarded! Purchase Order auto-generated.');
        setIsCompareOpen(false);
        refreshQuotes();
        pageCache.invalidate('orders:');
        pageCache.invalidate('requests:');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to award contract');
    } finally {
      setAwardSubmitting(false);
    }
  };

  const groupedCompare = () => {
    const bySupplier = new Map();
    compareQuotes.forEach((q) => {
      const key = String(q.supplier?._id || q.supplier);
      if (!bySupplier.has(key)) bySupplier.set(key, []);
      bySupplier.get(key).push(q);
    });
    const groups = [...bySupplier.values()].map((quotes) => {
      const lines = requestLines(comparingRequest);
      const lineQuotes = lines.map((line) => {
        const q = quotes.find((x) => requestIdOfQuote(x) === lineId(line));
        return { line, quote: q };
      });
      const subtotal = lineQuotes.reduce((sum, { line, quote }) => {
        if (!quote) return sum;
        return sum + Number(line.quantity || 0) * Number(quote.unitPrice || 0);
      }, 0);
      const shipping = quotes.reduce((sum, q) => sum + Number(q.deliveryCost || 0), 0);
      return {
        supplier: quotes[0].supplier,
        quotes,
        lineQuotes,
        subtotal,
        shipping,
        total: subtotal + shipping,
        deliveryTimeDays: quotes[0].deliveryTimeDays,
        warrantyMonths: quotes[0].warrantyMonths,
        paymentTerms: quotes[0].paymentTerms,
        awardId: quotes[0]._id
      };
    });
    const totals = groups.map((g) => g.total);
    const times = groups.map((g) => Number(g.deliveryTimeDays) || 0);
    return {
      groups,
      lowestTotal: totals.length ? Math.min(...totals) : null,
      fastestDelivery: times.length ? Math.min(...times) : null
    };
  };

  const compareView = comparingRequest ? groupedCompare() : { groups: [] };
  const bidLines = biddingRequest ? requestLines(biddingRequest) : [];

  const headers = [
    { key: 'project', label: 'Target Project', render: (r) => (
      <div>
        <p className="font-bold text-slate-800 dark:text-slate-200">{r.project?.name}</p>
        <p className="text-[10px] text-slate-500">{r.project?.location}</p>
      </div>
    )},
    { key: 'material', label: 'Required Material', render: (r) => (
      <div>
        {requestLines(r).map((line) => (
          <div key={lineId(line)} className="mb-1 last:mb-0">
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {line.quantity} {line.material?.unit}
            </p>
            <p className="text-xs text-slate-500">{line.material?.name}</p>
          </div>
        ))}
      </div>
    )},
    { key: 'requiredDate', label: 'Required By', render: (r) => new Date(r.requiredDate).toLocaleDateString() },
    { key: 'bidsCount', label: 'Submitted Bids', render: (r) => {
      const count = bidCount(r);
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold rounded-lg bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/10 dark:text-brand-primaryHover">
          {count} bid{count !== 1 ? 's' : ''}
        </span>
      );
    }},
    { key: 'actions', label: 'Actions', render: (r) => {
      const myPending = myPendingQuotesFor(r);
      const hasMyPending = myPending.length > 0;
      return (
      <div className="flex items-center gap-2">
        {isSupplier && (
          <button
            onClick={() => handleOpenBid(r, hasMyPending)}
            className="px-3 py-1.5 text-xs font-bold bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg shadow-sm transition-colors"
          >
            {hasMyPending ? 'Edit Bid' : 'Submit Bid'}
          </button>
        )}
        {isProc && (
          <button
            onClick={() => handleOpenCompare(r)}
            className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 dark:hover:bg-slate-900 text-white rounded-lg shadow-sm transition-colors"
          >
            Compare Bids
          </button>
        )}
      </div>
      );
    }}
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="bf-page-title">Supplier Bidding Board</h1>
        <p className="bf-page-subtitle">
          Review approved requests, submit bidding quotes, and compare options for contract awards.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Open Bidding Requests</h3>
        <Table
          headers={headers}
          data={approvedRequests}
          loading={loading}
          emptyMessage="No approved requests open for supplier quotes."
        />
      </div>

      <Modal
        isOpen={isBidOpen}
        onClose={() => {
          setIsBidOpen(false);
          setEditingBid(false);
        }}
        title={editingBid ? 'Edit Bidding Quote' : 'Submit Bidding Quote'}
      >
        {biddingRequest && (
          <form onSubmit={onBidSubmit} className="space-y-4 py-2">
            <div className="bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-850 p-3.5 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Bidding Target</span>
              <p className="text-xs text-slate-500 leading-snug">Project: {biddingRequest.project?.name}</p>
              <ul className="mt-2 space-y-1">
                {bidLines.map((line) => (
                  <li key={lineId(line)} className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {line.quantity} {line.material?.unit} of {line.material?.name}
                  </li>
                ))}
              </ul>
            </div>

            {bidLines.map((line) => (
              <div key={lineId(line)}>
                <label className="block text-xs font-bold text-slate-400 uppercase">
                  Unit Price — {line.material?.name} ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={linePrices[lineId(line)] ?? ''}
                  onChange={(e) =>
                    setLinePrices((prev) => ({ ...prev, [lineId(line)]: e.target.value }))
                  }
                  className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                  required
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Delivery Shipping Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(e.target.value)}
                  className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Delivery Time (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={deliveryTimeDays}
                  onChange={(e) => setDeliveryTimeDays(e.target.value)}
                  className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Warranty Limit (Months)</label>
                <input
                  type="number"
                  min="0"
                  value={warrantyMonths}
                  onChange={(e) => setWarrantyMonths(e.target.value)}
                  className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Payment Terms offered</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                >
                  <option value="Cash on Delivery">Cash on Delivery</option>
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 60">Net 60</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={bidSubmitting}
              className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors"
            >
              {bidSubmitting ? 'Saving…' : editingBid ? 'Save Bid Changes' : 'Post Bid Quotation'}
            </button>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        title="Compare Quotation Offers"
      >
        {comparingRequest && (
          <div className="space-y-6 py-2">
            <div className="bg-slate-50 dark:bg-slate-950/30 p-3 rounded-xl border border-slate-100 dark:border-slate-850 text-xs">
              <span className="font-bold text-slate-400 uppercase block">Fulfillment Target</span>
              <p className="text-slate-500 mt-0.5">Project: {comparingRequest.project?.name}</p>
              <ul className="mt-2 space-y-0.5">
                {requestLines(comparingRequest).map((line) => (
                  <li key={lineId(line)} className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    {line.quantity} {line.material?.unit} of {line.material?.name}
                  </li>
                ))}
              </ul>
            </div>

            {compareView.groups.length === 0 ? (
              <p className="text-center text-sm py-8 text-slate-400 font-medium">No quotation bids submitted yet.</p>
            ) : (
              <div className="space-y-4">
                {compareView.groups.map((group) => {
                  const isLowest = group.total === compareView.lowestTotal;
                  const isFastest = group.deliveryTimeDays === compareView.fastestDelivery;
                  const scoreStars = group.supplier?.performanceRating || 5;

                  return (
                    <div
                      key={group.awardId}
                      className={`p-4 border rounded-2xl relative space-y-3 transition-shadow hover:shadow-md ${
                        isLowest
                          ? 'border-green-500/50 bg-green-50/5 dark:bg-green-950/5'
                          : 'border-brand-border dark:border-brand-darkBorder'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white leading-snug">
                            {group.supplier?.company}
                          </h4>
                          <div className="flex text-amber-500 gap-0.5 mt-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <FiStar key={i} className={`h-3.5 w-3.5 ${i < scoreStars ? 'fill-current' : 'text-slate-200 dark:text-slate-800'}`} />
                            ))}
                          </div>
                        </div>
                        {isLowest && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                            <FiTrendingDown /> Best Price
                          </span>
                        )}
                      </div>

                      <ul className="text-xs space-y-1">
                        {group.lineQuotes.map(({ line, quote }) => (
                          <li key={lineId(line)} className="flex justify-between gap-2">
                            <span className="text-slate-500">
                              {line.quantity} {line.material?.unit} {line.material?.name}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              ${Number(quote?.unitPrice || 0).toFixed(2)}/unit
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Materials</span>
                          <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">${group.subtotal.toFixed(2)}</p>
                        </div>
                        <div className="border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Shipping Fee</span>
                          <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">${group.shipping.toFixed(2)}</p>
                        </div>
                        <div className="border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl bg-teal-50/10 dark:bg-teal-950/10 border-brand-primary/20">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Est. Grand Total</span>
                          <p className="text-sm font-extrabold text-brand-primary dark:text-brand-primaryHover mt-0.5">
                            ${group.total.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4 text-xs font-semibold text-slate-500">
                        <span className="flex items-center gap-1">
                          <FiClock className={isFastest ? 'text-green-500' : 'text-slate-400'} />
                          Delivery: <strong>{group.deliveryTimeDays} days</strong>
                        </span>
                        <span>
                          Warranty: <strong>{group.warrantyMonths} months</strong>
                        </span>
                        <span>
                          Terms: <strong>{group.paymentTerms}</strong>
                        </span>
                      </div>

                      <button
                        onClick={() => handleAwardContract(group.awardId)}
                        disabled={awardSubmitting}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl bg-brand-primary hover:bg-brand-primaryHover text-white shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FiAward /> {awardSubmitting ? 'Saving…' : 'Award Contract & Issue PO'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Quotations;
