import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search,
  Filter,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  QrCode,
  Tag,
  ArrowRight,
  Info,
  Layers,
  Camera,
  X,
  Sparkles
} from 'lucide-react';
import { equipmentService, borrowService } from '../services/api';
import { useToast } from '../components/Toast';

export default function EquipmentCatalog({ currentUser }) {
  const toast = useToast();
  const location = useLocation();

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState({ total: 0, AVAILABLE: 0, BORROWED: 0, UNDER_REPAIR: 0 });
  const [loading, setLoading] = useState(true);

  // Active Tab: 'catalog' | 'my-loans'
  const [activeTab, setActiveTab] = useState('catalog');
  const [myLoans, setMyLoans] = useState([]);
  const [loansLoading, setLoansLoading] = useState(false);

  // Check query params for direct tab navigation from Overdue notification
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'my-loans') {
      setActiveTab('my-loans');
    }
  }, [location.search]);

  // Load myLoans on mount to detect borrower overdue status immediately
  useEffect(() => {
    loadMyLoans();
  }, []);

  // Reservation Modal state
  const [reserveModalItem, setReserveModalItem] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Item Detail Modal
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);

  // Fetch equipment list
  const loadEquipment = async () => {
    try {
      setLoading(true);
      const res = await equipmentService.getAll({
        category: selectedCategory,
        status: selectedStatus,
        search: searchQuery,
      });
      setItems(res.data.items);
      setSummary(res.data.summary);
    } catch (err) {
      toast.error('Failed to load equipment catalog');
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories
  const loadCategories = async () => {
    try {
      const res = await equipmentService.getCategories();
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch borrower loans
  const loadMyLoans = async () => {
    try {
      setLoansLoading(true);
      const res = await borrowService.getMyLoans();
      setMyLoans(res.data);
    } catch (err) {
      toast.error('Failed to load your loan history');
    } finally {
      setLoansLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadEquipment();
  }, [selectedCategory, selectedStatus, searchQuery]);

  useEffect(() => {
    if (activeTab === 'my-loans') {
      loadMyLoans();
    }
  }, [activeTab]);

  // Handle borrowing reservation submit
  const handleReserveSubmit = async (e) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      toast.warning('Please select pickup and return dates');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      toast.error('Return deadline must be after the pickup start date');
      return;
    }

    setSubmittingRequest(true);

    try {
      await borrowService.requestLoan({
        equipment_id: reserveModalItem.id,
        request_start_date: startDate,
        request_end_date: endDate,
        purpose,
      });

      toast.success('Reservation request submitted! Custodians will review shortly.');
      setReserveModalItem(null);
      setPurpose('');
      setStartDate('');
      setEndDate('');
      if (activeTab === 'my-loans') loadMyLoans();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit loan request');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const getStatusBadge = (item) => {
    const isOverdue = typeof item === 'object' && (item.is_overdue === 1 || item.status === 'OVERDUE');
    if (isOverdue) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5" />
          BORROWED (OVERDUE)
        </span>
      );
    }
    const status = typeof item === 'string' ? item : item.status;
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            AVAILABLE
          </span>
        );
      case 'BORROWED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            BORROWED
          </span>
        );
      case 'UNDER_REPAIR':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
            UNDER REPAIR
          </span>
        );
      default:
        return (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold"
            style={{ backgroundColor: '#253745', color: '#CCD0CF' }}
          >
            {status}
          </span>
        );
    }
  };

  const myOverdueLoans = myLoans.filter(
    (l) => l.status === 'OVERDUE' || (l.status === 'CHECKED_OUT' && new Date(l.request_end_date) < new Date())
  );

  const getLoanStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[11px] px-2.5 py-0.5 rounded-md font-semibold">Pending Custodian Review</span>;
      case 'APPROVED':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] px-2.5 py-0.5 rounded-md font-semibold">Approved (Ready for Pickup)</span>;
      case 'CHECKED_OUT':
        return (
          <span
            className="text-[11px] px-2.5 py-0.5 rounded-md font-semibold"
            style={{ backgroundColor: '#253745', color: '#CCD0CF', border: '1px solid #4A5C6A' }}
          >
            Currently Checked Out
          </span>
        );
      case 'OVERDUE':
        return <span className="bg-rose-50 text-rose-700 border border-rose-300 text-[11px] px-2.5 py-0.5 rounded-md font-bold animate-pulse">OVERDUE • Return Required</span>;
      case 'RETURNED':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] px-2.5 py-0.5 rounded-md font-semibold">Returned &amp; Verified</span>;
      case 'REJECTED':
        return (
          <span
            className="text-[11px] px-2.5 py-0.5 rounded-md font-semibold"
            style={{ backgroundColor: '#253745', color: '#9BA8AB', border: '1px solid #4A5C6A' }}
          >
            Request Rejected
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner & Tab Navigation */}
      <div
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5"
        style={{ borderBottom: '1px solid #253745' }}
      >
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] px-2.5 py-0.5 rounded-md font-semibold tracking-wide uppercase">
              Role 1: Equipment Catalog &amp; Reservations
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-1.5" style={{ color: '#000000' }}>
            Institutional Equipment Catalog
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: '#000000' }}>
            Browse laboratory instruments, cinema cameras, and computing gear with real-time status.
          </p>
        </div>

        {/* Tab switchers */}
        <div
          className="flex items-center p-1 rounded-xl self-start md:self-auto"
          style={{ backgroundColor: '#ffffff', border: '1px solid #253745' }}
        >
          <button
            onClick={() => setActiveTab('catalog')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5"
            style={
              activeTab === 'catalog'
                ? { backgroundColor: '#253745', color: '#CCD0CF', border: '1px solid #4A5C6A' }
                : { color: '#000000' }
            }
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Catalog Explorer</span>
          </button>

          <button
            onClick={() => setActiveTab('my-loans')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5"
            style={
              activeTab === 'my-loans'
                ? { backgroundColor: '#253745', color: '#CCD0CF', border: '1px solid #4A5C6A' }
                : { color: '#000000' }
            }
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>My Borrowing &amp; Due Dates</span>
            {myLoans.filter((l) => l.status === 'OVERDUE').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>
        </div>
      </div>

      {/* Overdue Warning Alert Banner for Borrower */}
      {myOverdueLoans.length > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-950 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm">Action Required: You have {myOverdueLoans.length} overdue equipment loan(s)!</h4>
              <p className="text-[11px] text-rose-800 mt-0.5">Please return past-due equipment to the IT / Lab depot immediately to avoid registration holds or disciplinary fines.</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('my-loans')}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors shadow-2xs"
          >
            View Overdue Items
          </button>
        </div>
      )}

      {activeTab === 'catalog' ? (
        <>
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div
              className="p-3.5 sm:p-4 rounded-2xl"
              style={{ backgroundColor: '#ffffff', border: '2px solid #253745' }}
            >
              <span className="text-[11px] font-medium" style={{ color: '#000000' }}>Total Catalog Assets</span>
              <p className="text-xl sm:text-2xl font-bold mt-0.5" style={{ color: '#000000' }}>{summary.total}</p>
            </div>
            <div
              className="p-3.5 sm:p-4 rounded-2xl"
              style={{ backgroundColor: '#ffffff', border: '2px solid #253745' }}
            >
              <span className="text-[11px] font-medium text-emerald-500 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                Available (Ready)
              </span>
              <p className="text-xl sm:text-2xl font-bold text-emerald-500 mt-0.5">{summary.AVAILABLE}</p>
            </div>
            <div
              className="p-3.5 sm:p-4 rounded-2xl"
              style={{ backgroundColor: '#ffffff', border: '2px solid #253745' }}
            >
              <span className="text-[11px] font-medium text-amber-500 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
                Borrowed (In Use)
              </span>
              <p className="text-xl sm:text-2xl font-bold text-amber-500 mt-0.5">{summary.BORROWED}</p>
            </div>
            <div
              className="p-3.5 sm:p-4 rounded-2xl"
              style={{ backgroundColor: '#ffffff', border: '2px solid #253745' }}
            >
              <span className="text-[11px] font-medium text-rose-500 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
                Under Maintenance
              </span>
              <p className="text-xl sm:text-2xl font-bold text-rose-500 mt-0.5">{summary.UNDER_REPAIR}</p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div
            className="p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between"
            style={{ backgroundColor: '#11212D', border: '1px solid #253745' }}
          >
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#9BA8AB' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search equipment by name, asset tag, model, or specs..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                style={{
                  backgroundColor: '#06141B',
                  border: '1px solid #253745',
                  color: '#CCD0CF',
                  '--placeholder-color': '#4A5C6A',
                }}
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                style={{
                  backgroundColor: '#06141B',
                  border: '1px solid #253745',
                  color: '#CCD0CF',
                }}
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                style={{
                  backgroundColor: '#06141B',
                  border: '1px solid #253745',
                  color: '#CCD0CF',
                }}
              >
                <option value="All">All Statuses</option>
                <option value="AVAILABLE">Available Only</option>
                <option value="BORROWED">Borrowed</option>
                <option value="UNDER_REPAIR">Under Repair</option>
              </select>
            </div>
          </div>

          {/* Equipment Cards Grid */}
          {loading ? (
            <div className="py-20 text-center text-xs" style={{ color: '#9BA8AB' }}>Querying institutional equipment catalog...</div>
          ) : items.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{ backgroundColor: '#11212D', border: '1px solid #253745' }}
            >
              <Layers className="w-10 h-10 mx-auto mb-2.5" style={{ color: '#4A5C6A' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#CCD0CF' }}>No equipment items found</h3>
              <p className="text-xs mt-1" style={{ color: '#9BA8AB' }}>Try modifying your search criteria or category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl overflow-hidden transition-all duration-200 flex flex-col group"
                  style={{
                    backgroundColor: '#11212D',
                    border: '1px solid #253745',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)'; e.currentTarget.style.borderColor = '#4A5C6A'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)'; e.currentTarget.style.borderColor = '#253745'; }}
                >
                  {/* Photo & Status Badge */}
                  <div className="relative h-44 overflow-hidden" style={{ backgroundColor: '#253745' }}>
                    <img
                      src={item.image_url || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80'}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3">{getStatusBadge(item)}</div>
                    <div className="absolute top-3 right-3 bg-zinc-950/80 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                      {item.asset_tag}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#9BA8AB' }}>
                        {item.category}
                      </div>
                      <h3 className="text-sm font-bold mt-0.5 leading-snug" style={{ color: '#CCD0CF' }}>
                        {item.name}
                      </h3>
                      {item.model && (
                        <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: '#9BA8AB' }}>
                          Model: {item.model}
                        </p>
                      )}
                      <p
                        className="text-[11px] mt-2 p-2.5 rounded-xl line-clamp-2"
                        style={{ color: '#9BA8AB', backgroundColor: 'rgba(37,55,69,0.4)', border: '1px solid #253745' }}
                      >
                        {item.condition_notes || 'Standard operational condition.'}
                      </p>
                      <div className="mt-2.5 flex items-center text-[11px]" style={{ color: '#9BA8AB' }}>
                        <Tag className="w-3.5 h-3.5 mr-1" style={{ color: '#4A5C6A' }} />
                        <span>Location: {item.location || 'Central IT Depot'}</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-4 pt-3 flex items-center justify-between gap-2" style={{ borderTop: '1px solid #253745' }}>
                      <button
                        onClick={() => setSelectedItemDetail(item)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        style={{ color: '#9BA8AB' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#253745'; e.currentTarget.style.color = '#CCD0CF'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9BA8AB'; }}
                      >
                        Inspect QR &amp; Tag
                      </button>

                      {item.status === 'AVAILABLE' ? (
                        <button
                          onClick={() => {
                            setReserveModalItem(item);
                            const today = new Date();
                            const tomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
                            setStartDate(today.toISOString().slice(0, 16));
                            setEndDate(tomorrow.toISOString().slice(0, 16));
                          }}
                          className="text-white text-xs font-semibold py-1.5 px-3.5 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer active:scale-[0.98]"
                          style={{ backgroundColor: '#253745', border: '1px solid #4A5C6A', color: '#CCD0CF' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4A5C6A'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#253745'; }}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Reserve</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium italic" style={{ color: '#9BA8AB' }}>
                          {item.status === 'BORROWED' ? 'Currently on loan' : 'Under maintenance'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* My Loans & Due Date Dashboard */
        <div className="space-y-6">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#11212D', border: '1px solid #253745' }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ backgroundColor: '#06141B', borderBottom: '1px solid #253745' }}
            >
              <div>
                <h2 className="text-sm font-bold" style={{ color: '#CCD0CF' }}>My Equipment Loans &amp; Due Dates</h2>
                <p className="text-[11px] mt-0.5" style={{ color: '#9BA8AB' }}>Track active checkouts, return deadlines, and condition photo logs</p>
              </div>
              <button
                onClick={loadMyLoans}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ backgroundColor: '#253745', color: '#CCD0CF', border: '1px solid #4A5C6A' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4A5C6A'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#253745'; }}
              >
                Refresh List
              </button>
            </div>

            {loansLoading ? (
              <div className="p-12 text-center text-xs" style={{ color: '#9BA8AB' }}>Loading personal borrowing records...</div>
            ) : myLoans.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-10 h-10 mx-auto mb-2" style={{ color: '#4A5C6A' }} />
                <h4 className="font-bold text-sm" style={{ color: '#CCD0CF' }}>No active or past loans</h4>
                <p className="text-xs mt-1" style={{ color: '#9BA8AB' }}>Browse the catalog to submit your first reservation request.</p>
              </div>
            ) : (
              <div>
                {myLoans.map((loan, idx) => {
                  const isOverdue = loan.status === 'OVERDUE';
                  const returnDate = new Date(loan.request_end_date);
                  const isPastDue = new Date() > returnDate && loan.status === 'CHECKED_OUT';
                  const rowBg = isOverdue
                    ? 'rgba(255,228,230,0.07)'
                    : idx % 2 === 0
                    ? '#11212D'
                    : 'rgba(37,55,69,0.4)';

                  return (
                    <div
                      key={loan.id}
                      className="p-5 transition-colors"
                      style={{
                        backgroundColor: rowBg,
                        borderBottom: '1px solid #253745',
                      }}
                      onMouseEnter={(e) => { if (!isOverdue) e.currentTarget.style.backgroundColor = '#253745'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = rowBg; }}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start space-x-3.5">
                          <img
                            src={loan.image_url || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80'}
                            alt={loan.equipment_name}
                            className="w-14 h-14 rounded-xl object-cover shrink-0"
                            style={{ border: '1px solid #4A5C6A' }}
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span
                                className="font-mono text-[11px] font-bold px-2 py-0.5 rounded"
                                style={{ backgroundColor: '#253745', color: '#CCD0CF', border: '1px solid #4A5C6A' }}
                              >
                                {loan.asset_tag}
                              </span>
                              <h4 className="font-bold text-sm" style={{ color: '#CCD0CF' }}>{loan.equipment_name}</h4>
                            </div>
                            <p className="text-xs mt-1" style={{ color: '#9BA8AB' }}>
                              <strong style={{ color: '#CCD0CF' }}>Purpose:</strong> {loan.purpose}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: '#9BA8AB' }}>
                              <span>
                                <strong style={{ color: '#CCD0CF' }}>Period:</strong> {new Date(loan.request_start_date).toLocaleDateString()} → {new Date(loan.request_end_date).toLocaleDateString()}
                              </span>
                              {loan.actual_checkout_date && (
                                <span>
                                  <strong style={{ color: '#CCD0CF' }}>Checked Out:</strong> {new Date(loan.actual_checkout_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status & Deadline */}
                        <div className="flex flex-col items-start md:items-end justify-between space-y-1.5">
                          <div>{getLoanStatusBadge(loan.status)}</div>

                          <div className="text-xs">
                            <span style={{ color: '#9BA8AB' }}>Return Deadline: </span>
                            <span
                              className="font-mono font-bold"
                              style={{ color: isOverdue || isPastDue ? '#f43f5e' : '#CCD0CF' }}
                            >
                              {new Date(loan.request_end_date).toLocaleString()}
                            </span>
                          </div>

                          {isOverdue && (
                            <div className="bg-rose-100 border border-rose-200 text-rose-800 text-[10px] font-semibold px-2 py-0.5 rounded flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3 shrink-0 text-rose-600" />
                              <span>Overdue notice dispatched to student email</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Photo evidence */}
                      {loan.photos && loan.photos.length > 0 && (
                        <div className="mt-3.5 pt-3" style={{ borderTop: '1px solid #253745' }}>
                          <p className="text-[11px] font-semibold mb-2 flex items-center" style={{ color: '#CCD0CF' }}>
                            <Camera className="w-3 h-3 mr-1" style={{ color: '#9BA8AB' }} />
                            Inspection Photo Evidence ({loan.photos.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {loan.photos.map((photo) => (
                              <div
                                key={photo.id}
                                className="relative group rounded-lg overflow-hidden w-20 h-14"
                                style={{ border: '1px solid #4A5C6A', backgroundColor: '#06141B' }}
                              >
                                <img src={photo.image_url} alt="Loan condition proof" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-zinc-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1 text-[8px] text-white text-center font-mono">
                                  {photo.photo_type}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reservation Request Modal */}
      {reserveModalItem && (
        <div className="fixed inset-0 z-50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ backgroundColor: 'rgba(6,20,27,0.75)' }}>
          <div
            className="rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden my-8"
            style={{ backgroundColor: '#11212D', border: '1px solid #4A5C6A' }}
          >
            <div
              className="p-4.5 flex items-center justify-between"
              style={{ backgroundColor: '#06141B', borderBottom: '1px solid #253745' }}
            >
              <div>
                <h3 className="font-bold text-sm" style={{ color: '#CCD0CF' }}>Submit Equipment Reservation</h3>
                <p className="text-[11px] mt-0.5" style={{ color: '#9BA8AB' }}>Role 1: Borrower Online Reservation Flow</p>
              </div>
              <button
                onClick={() => setReserveModalItem(null)}
                className="p-1 rounded-lg cursor-pointer transition-colors"
                style={{ color: '#9BA8AB' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#CCD0CF'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#9BA8AB'; }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReserveSubmit} className="p-6 space-y-4">
              <div
                className="p-3 rounded-xl flex items-center space-x-3"
                style={{ backgroundColor: '#06141B', border: '1px solid #253745' }}
              >
                <img
                  src={reserveModalItem.image_url}
                  alt={reserveModalItem.name}
                  className="w-12 h-12 object-cover rounded-lg shrink-0"
                  style={{ border: '1px solid #4A5C6A' }}
                />
                <div>
                  <div className="text-[10px] uppercase font-bold" style={{ color: '#9BA8AB' }}>{reserveModalItem.category}</div>
                  <div className="font-bold text-xs sm:text-sm" style={{ color: '#CCD0CF' }}>{reserveModalItem.name}</div>
                  <div className="text-[11px] font-mono" style={{ color: '#4A5C6A' }}>Tag: {reserveModalItem.asset_tag}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#CCD0CF' }}>
                    Pickup Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #253745',
                      color: '#000000',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#CCD0CF' }}>
                    Return Deadline *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #253745',
                      color: '#000000',
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#CCD0CF' }}>
                  Purpose / Project Specification *
                </label>
                <textarea
                  required
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Media Production Senior Thesis Documentary film shoot on campus..."
                  className="w-full text-xs p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  style={{
                    backgroundColor: '#06141B',
                    border: '1px solid #253745',
                    color: '#CCD0CF',
                  }}
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2" style={{ borderTop: '1px solid #253745' }}>
                <button
                  type="button"
                  onClick={() => setReserveModalItem(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                  style={{ color: '#9BA8AB', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#253745'; e.currentTarget.style.color = '#CCD0CF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9BA8AB'; }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="text-white px-5 py-2 text-xs font-semibold rounded-xl flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: '#253745', border: '1px solid #4A5C6A', color: '#CCD0CF' }}
                  onMouseEnter={(e) => { if (!submittingRequest) e.currentTarget.style.backgroundColor = '#4A5C6A'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#253745'; }}
                >
                  <span>Submit Reservation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Detail & QR View Modal */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ backgroundColor: 'rgba(6,20,27,0.75)' }}>
          <div
            className="rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            style={{ backgroundColor: '#11212D', border: '1px solid #4A5C6A' }}
          >
            <div
              className="p-4 flex items-center justify-between"
              style={{ backgroundColor: '#06141B', borderBottom: '1px solid #253745' }}
            >
              <span className="text-xs font-mono font-bold tracking-wider" style={{ color: '#CCD0CF' }}>{selectedItemDetail.asset_tag}</span>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="cursor-pointer transition-colors"
                style={{ color: '#9BA8AB' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#CCD0CF'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#9BA8AB'; }}
              >
                ✕
              </button>
            </div>
            <div className="p-6 text-center space-y-4">
              <div
                className="inline-block p-3 rounded-2xl"
                style={{ backgroundColor: '#06141B', border: '1px solid #253745' }}
              >
                {selectedItemDetail.qr_data ? (
                  <img
                    src={selectedItemDetail.qr_data}
                    alt={selectedItemDetail.asset_tag}
                    className="w-44 h-44 mx-auto"
                  />
                ) : (
                  <QrCode className="w-44 h-44 mx-auto" style={{ color: '#9BA8AB' }} />
                )}
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: '#CCD0CF' }}>{selectedItemDetail.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#9BA8AB' }}>{selectedItemDetail.category} • Model: {selectedItemDetail.model || 'N/A'}</p>
                <div className="mt-2 inline-block">{getStatusBadge(selectedItemDetail.status)}</div>
              </div>
              <p
                className="text-xs p-3 rounded-xl text-left"
                style={{ color: '#9BA8AB', backgroundColor: 'rgba(37,55,69,0.4)', border: '1px solid #253745' }}
              >
                <strong style={{ color: '#CCD0CF' }}>Condition Notes:</strong> {selectedItemDetail.condition_notes}
              </p>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="w-full text-xs font-semibold py-2.5 rounded-xl cursor-pointer transition-colors"
                style={{ backgroundColor: '#253745', border: '1px solid #4A5C6A', color: '#CCD0CF' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4A5C6A'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#253745'; }}
              >
                Close Asset View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
