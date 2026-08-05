import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import {
  FiPlus,
  FiLayers,
  FiTrendingDown,
  FiClock,
  FiStar,
  FiCheckCircle,
  FiAward,
  FiInfo,
  FiDollarSign,
  FiShield
} from 'react-icons/fi';

const Quotations = () => {
  const { user } = useAuth();
  const isSupplier = user?.role === 'Supplier' || user?.role === 'Administrator';
  const isProc = user?.role === 'Procurement Officer' || user?.role === 'Administrator';

  const [approvedRequests, setApprovedRequests] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isBidOpen, setIsBidOpen] = useState(false);
  const [biddingRequest, setBiddingRequest] = useState(null);

  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [comparingRequest, setComparingRequest] = useState(null);
  const [compareQuotes, setCompareQuotes] = useState([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm();

  const fetchApprovedRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/requests', { params: { status: 'Approved', limit: 100 } });
      if (res.data.success) {
        setApprovedRequests(res.data.requests);
      }
    } catch (err) {
      toast.error('Failed to load approved requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotations = async () => {
    try {
      const res = await axios.get('/api/quotations');
      if (res.data.success) {
        setQuotations(res.data.quotations);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchApprovedRequests();
    fetchQuotations();
  }, []);

  const handleOpenBid = (request) => {
    setBiddingRequest(request);
    reset({
      unitPrice: request.material?.estimatedPrice || '',
      deliveryCost: 50,
      deliveryTimeDays: 3,
      warrantyMonths: 12,
      paymentTerms: 'Net 30'
    });
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

  const onBidSubmit = async (data) => {
    const postData = { ...data, materialRequest: biddingRequest._id };
    try {
      const res = await axios.post('/api/quotations', postData);
      if (res.data.success) {
        toast.success('Bid quotation submitted successfully!');
        setIsBidOpen(false);
        fetchQuotations();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit bid');
    }
  };

  const handleAwardContract = async (quoteId) => {
    if (!window.confirm('Are you sure you want to select this quotation and generate a Purchase Order?')) return;
    try {
      const res = await axios.put(`/api/quotations/${quoteId}/select`);
      if (res.data.success) {
        toast.success('Contract awarded! Purchase Order auto-generated.');
        setIsCompareOpen(false);
        fetchApprovedRequests();
        fetchQuotations();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to award contract');
    }
  };

  // Find lowest price and fastest delivery time to highlight
  const getHighlights = () => {
    if (compareQuotes.length === 0) return {};
    const prices = compareQuotes.map(q => q.unitPrice);
    const times = compareQuotes.map(q => q.deliveryTimeDays);
    return {
      lowestPrice: Math.min(...prices),
      fastestDelivery: Math.min(...times)
    };
  };

  const highlights = getHighlights();

  const headers = [
    { key: 'project', label: 'Target Project', render: (r) => (
      <div>
        <p className="font-bold text-slate-800 dark:text-slate-200">{r.project?.name}</p>
        <p className="text-[10px] text-slate-500">{r.project?.location}</p>
      </div>
    )},
    { key: 'material', label: 'Required Material', render: (r) => (
      <div>
        <p className="font-bold text-slate-800 dark:text-slate-200">
          {r.quantity} {r.material?.unit}
        </p>
        <p className="text-xs text-slate-500">{r.material?.name}</p>
      </div>
    )},
    { key: 'requiredDate', label: 'Required By', render: (r) => new Date(r.requiredDate).toLocaleDateString() },
    { key: 'bidsCount', label: 'Submitted Bids', render: (r) => {
      const count = quotations.filter(q => q.materialRequest?._id === r._id).length;
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400">
          {count} bid{count !== 1 ? 's' : ''}
        </span>
      );
    }},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-2">
        {isSupplier && (
          <button
            onClick={() => handleOpenBid(r)}
            className="px-3 py-1.5 text-xs font-bold bg-teal-700 hover:bg-teal-600 text-white rounded-lg shadow-sm transition-colors"
          >
            Submit Bid
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
    )}
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Supplier Bidding Board</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review approved requests, submit bidding quotes, and compare options for contract awards.
        </p>
      </div>

      {/* Requests open for bidding */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Open Bidding Requests</h3>
        <Table
          headers={headers}
          data={approvedRequests}
          loading={loading}
          emptyMessage="No approved requests open for supplier quotes."
        />
      </div>

      {/* Supplier Submit Bid Modal */}
      <Modal
        isOpen={isBidOpen}
        onClose={() => setIsBidOpen(false)}
        title="Submit Bidding Quote"
      >
        {biddingRequest && (
          <form onSubmit={handleSubmit(onBidSubmit)} className="space-y-4 py-2">
            <div className="bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-850 p-3.5 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Bidding Target</span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {biddingRequest.quantity} {biddingRequest.material?.unit} of {biddingRequest.material?.name}
              </p>
              <p className="text-xs text-slate-500 leading-snug">Project: {biddingRequest.project?.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Unit Price Offer ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className={`w-full mt-1.5 px-4 py-2 border ${
                    errors.unitPrice ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                  } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500`}
                  {...register('unitPrice', { required: 'Required', min: { value: 0, message: 'Must be positive' } })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Delivery Shipping Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className={`w-full mt-1.5 px-4 py-2 border ${
                    errors.deliveryCost ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                  } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500`}
                  {...register('deliveryCost', { required: 'Required', min: { value: 0, message: 'Must be positive' } })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Delivery Time (Days)</label>
                <input
                  type="number"
                  className={`w-full mt-1.5 px-4 py-2 border ${
                    errors.deliveryTimeDays ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                  } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500`}
                  {...register('deliveryTimeDays', { required: 'Required', min: { value: 1, message: 'At least 1 day' } })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Warranty Limit (Months)</label>
                <input
                  type="number"
                  className="w-full mt-1.5 px-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500"
                  {...register('warrantyMonths')}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Payment Terms offered</label>
              <select
                className="w-full mt-1.5 px-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-teal-500"
                {...register('paymentTerms')}
              >
                <option value="Cash on Delivery">Cash on Delivery</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 60">Net 60</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full mt-4 bg-teal-700 hover:bg-teal-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors"
            >
              Post Bid Quotation
            </button>
          </form>
        )}
      </Modal>

      {/* Procurement Compare Bids Modal */}
      <Modal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        title="Compare Quotation Offers"
      >
        {comparingRequest && (
          <div className="space-y-6 py-2">
            
            {/* Header info */}
            <div className="bg-slate-50 dark:bg-slate-950/30 p-3 rounded-xl border border-slate-100 dark:border-slate-850 text-xs">
              <span className="font-bold text-slate-400 uppercase block">Fulfillment Target</span>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-100 mt-1">
                {comparingRequest.quantity} {comparingRequest.material?.unit} of {comparingRequest.material?.name}
              </p>
              <p className="text-slate-500 mt-0.5">Project: {comparingRequest.project?.name}</p>
            </div>

            {/* Side-by-side matrices */}
            {compareQuotes.length === 0 ? (
              <p className="text-center text-sm py-8 text-slate-400 font-medium">No quotation bids submitted yet.</p>
            ) : (
              <div className="space-y-4">
                {compareQuotes.map((quote) => {
                  const isLowest = quote.unitPrice === highlights.lowestPrice;
                  const isFastest = quote.deliveryTimeDays === highlights.fastestDelivery;
                  const scoreStars = quote.supplier?.performanceRating || 5;

                  return (
                    <div
                      key={quote._id}
                      className={`p-4 border rounded-2xl relative space-y-3 transition-shadow hover:shadow-md ${
                        isLowest
                          ? 'border-green-500/50 bg-green-50/5 dark:bg-green-950/5'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {/* Top Supplier Profile */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white leading-snug">
                            {quote.supplier?.company}
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

                      {/* Financial parameters */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Unit Price offer</span>
                          <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">${quote.unitPrice.toFixed(2)}</p>
                        </div>
                        <div className="border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Shipping Fee</span>
                          <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">${quote.deliveryCost.toFixed(2)}</p>
                        </div>
                        <div className="border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl bg-teal-50/10 dark:bg-teal-950/10 border-teal-500/20">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Est. Grand Total</span>
                          <p className="text-sm font-extrabold text-teal-600 dark:text-teal-400 mt-0.5">
                            ${(comparingRequest.quantity * quote.unitPrice + quote.deliveryCost).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Logistic parameters */}
                      <div className="flex gap-4 text-xs font-semibold text-slate-500">
                        <span className="flex items-center gap-1">
                          <FiClock className={isFastest ? 'text-green-500' : 'text-slate-400'} />
                          Delivery: <strong>{quote.deliveryTimeDays} days</strong>
                        </span>
                        <span>
                          Warranty: <strong>{quote.warrantyMonths} months</strong>
                        </span>
                        <span>
                          Terms: <strong>{quote.paymentTerms}</strong>
                        </span>
                      </div>

                      {/* Select button */}
                      <button
                        onClick={() => handleAwardContract(quote._id)}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl bg-teal-700 hover:bg-teal-600 text-white shadow-md transition-colors"
                      >
                        <FiAward /> Award Contract & Issue PO
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
