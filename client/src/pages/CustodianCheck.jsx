import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  QrCode,
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Clock,
  Layers,
  Search,
  Check,
  X,
  FileText,
  User,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  SplitSquareVertical,
  Calendar
} from 'lucide-react';
import QRCodeScanner from '../components/QRCodeScanner';
import DamagePhotoUpload from '../components/DamagePhotoUpload';
import { borrowService, checkService, equipmentService } from '../services/api';
import { useToast } from '../components/Toast';

export default function CustodianCheck({ currentUser }) {
  const toast = useToast();
  const location = useLocation();

  // Main modes: 'scan' | 'pending' | 'active-loans' | 'compare-modal'
  const [activeTab, setActiveTab] = useState('scan');

  // Scanner workflow states
  const [scannedTag, setScannedTag] = useState('');
  const [equipmentData, setEquipmentData] = useState(null);
  const [activeTransaction, setActiveTransaction] = useState(null);
  const [baselinePhotos, setBaselinePhotos] = useState([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Inspection action: 'CHECK_OUT' | 'CHECK_IN'
  const [inspectionMode, setInspectionMode] = useState('CHECK_OUT');
  const [inspectionPhotos, setInspectionPhotos] = useState([]);
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [damageState, setDamageState] = useState({ hasDamage: false, severity: 'NONE', notes: '' });
  const [processingInspection, setProcessingInspection] = useState(false);

  // Pending requests queue
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Active Loans list
  const [activeLoans, setActiveLoans] = useState([]);
  const [activeLoansLoading, setActiveLoansLoading] = useState(false);

  // Pre vs Post Comparison Modal
  const [comparisonData, setComparisonData] = useState(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  // Check query params for direct tab navigation from Overdue notification
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'active-loans') {
      setActiveTab('active-loans');
    }
  }, [location.search]);

  // Always load active loans on mount to know overdue count
  useEffect(() => {
    loadActiveLoans();
    loadPending();
  }, []);

  // Load pending queue
  const loadPending = async () => {
    try {
      setPendingLoading(true);
      const res = await borrowService.getPending();
      setPendingRequests(res.data);
    } catch (err) {
      toast.error('Failed to load pending requests');
    } finally {
      setPendingLoading(false);
    }
  };

  // Load active loans
  const loadActiveLoans = async () => {
    try {
      setActiveLoansLoading(true);
      const res = await borrowService.getActiveLoans();
      setActiveLoans(res.data);
    } catch (err) {
      toast.error('Failed to load active loans');
    } finally {
      setActiveLoansLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') loadPending();
    if (activeTab === 'active-loans') loadActiveLoans();
  }, [activeTab]);

  const overdueCount = activeLoans.filter(
    (l) => l.status === 'OVERDUE' || (l.status === 'CHECKED_OUT' && new Date(l.request_end_date) < new Date())
  ).length;

  // Handle scanned QR code tag
  const handleTagScanned = async (tag) => {
    setScannedTag(tag);
    setLookupError('');
    setLookingUp(true);

    try {
      const res = await equipmentService.getByTag(tag);
      setEquipmentData(res.data.item);
      setActiveTransaction(res.data.activeTransaction || null);
      setBaselinePhotos(res.data.lastPhotos || []);

      // Auto-set mode: If equipment is currently BORROWED or OVERDUE, set to CHECK_IN
      if (res.data.item.status === 'BORROWED' || res.data.activeTransaction) {
        setInspectionMode('CHECK_IN');
      } else {
        setInspectionMode('CHECK_OUT');
      }

      setInspectionPhotos([]);
      setInspectionNotes('');
      setDamageState({ hasDamage: false, severity: 'NONE', notes: '' });
      toast.info(`Asset ${tag} recognized`);
    } catch (err) {
      setLookupError(err.response?.data?.error || `Asset tag '${tag}' not recognized in database.`);
      setEquipmentData(null);
      setActiveTransaction(null);
    } finally {
      setLookingUp(false);
    }
  };

  // Submit Check-Out or Check-In
  const handleProcessInspection = async () => {
    if (!equipmentData) return;
    setProcessingInspection(true);

    try {
      const formData = new FormData();
      formData.append('asset_tag', equipmentData.asset_tag);

      const base64List = [];
      inspectionPhotos.forEach((p) => {
        if (p.file) {
          formData.append('photos', p.file);
        } else if (p.base64) {
          base64List.push(p.base64);
        }
      });

      if (base64List.length > 0) {
        base64List.forEach((b64) => formData.append('base64Photos', b64));
      }

      if (inspectionMode === 'CHECK_OUT') {
        formData.append('notes', inspectionNotes || 'Pre-inspection clean');
        if (activeTransaction) {
          formData.append('transaction_id', activeTransaction.id);
        } else {
          formData.append('borrower_id', 3);
        }

        const res = await checkService.checkout(formData);
        toast.success(`Check-out confirmed! Asset marked BORROWED. ${res.data.photosRecorded} condition photo(s) saved.`);
      } else {
        // CHECK_IN Return
        formData.append('notes', damageState.hasDamage ? damageState.notes : inspectionNotes || 'Inspected on return');
        formData.append('has_damage', damageState.hasDamage);
        formData.append('damage_severity', damageState.severity);
        if (activeTransaction) {
          formData.append('transaction_id', activeTransaction.id);
        }

        const res = await checkService.checkin(formData);
        if (damageState.hasDamage) {
          toast.warning(`Damage recorded! Asset transferred to UNDER REPAIR with photo proof.`);
        } else {
          toast.success(`Equipment successfully checked in and marked AVAILABLE.`);
        }
      }

      setTimeout(() => {
        handleTagScanned(equipmentData.asset_tag);
        loadActiveLoans();
      }, 1000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Inspection submission failed');
    } finally {
      setProcessingInspection(false);
    }
  };

  // Approve reservation request
  const handleApprove = async (id) => {
    try {
      await borrowService.approve(id);
      toast.success('Request approved! Item is ready for desk check-out.');
      loadPending();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve request');
    }
  };

  // Reject reservation request
  const handleReject = async (id) => {
    try {
      await borrowService.reject(id, rejectionReason);
      setRejectingId(null);
      setRejectionReason('');
      toast.info('Borrowing request rejected');
      loadPending();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject request');
    }
  };

  // Open pre vs post comparison
  const openComparison = async (txId) => {
    try {
      setLoadingComparison(true);
      const res = await checkService.getComparison(txId);
      setComparisonData(res.data);
    } catch (err) {
      toast.error('Failed to load comparison proof');
    } finally {
      setLoadingComparison(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/80 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-blue-50 text-blue-700 border border-blue-200/80 text-[11px] px-2.5 py-0.5 rounded-md font-semibold tracking-wide uppercase">
              Role 2: Custodian Desk & Verification
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight mt-1.5">
            Equipment Check-In, Check-Out & Verification Engine
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Scan physical QR tags, inspect pre/post hardware conditions with live photos, and resolve liability disputes.
          </p>
        </div>

        <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200/80 overflow-x-auto self-start md:self-auto max-w-full">
          <button
            onClick={() => setActiveTab('scan')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'scan' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Scanner & Inspection</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 relative ${
              activeTab === 'pending' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Requests</span>
            {pendingRequests.length > 0 && (
              <span className="bg-zinc-900 text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('active-loans')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 relative ${
              activeTab === 'active-loans' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Active & Overdue Loans</span>
            {overdueCount > 0 && (
              <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                {overdueCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Custodian Overdue Alert Banner */}
      {overdueCount > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-950 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm">Overdue Alert: {overdueCount} equipment item(s) are currently past return deadline!</h4>
              <p className="text-[11px] text-rose-800 mt-0.5">Automated overdue email reminders have been dispatched. Check the Active Loans tab to review borrower details.</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('active-loans')}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors shadow-2xs"
          >
            Review Overdue Loans
          </button>
        </div>
      )}

      {/* TAB 1: SCANNER & PHOTO INSPECTION */}
      {activeTab === 'scan' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: QR Scanner */}
          <div className="lg:col-span-5 space-y-4">
            <QRCodeScanner
              title="Camera QR Code Asset Tag Scanner"
              onScanSuccess={(tag) => handleTagScanned(tag)}
            />

            <div className="bg-zinc-50 border border-zinc-200/90 rounded-2xl p-4 text-xs text-zinc-700 space-y-1">
              <p className="font-semibold text-zinc-900 flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-zinc-600" />
                Fast Distribution Desk Workflow:
              </p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                1. Point mobile/web camera at equipment QR sticker (or tap preset tag).
                <br />
                2. System auto-identifies active borrower and baseline condition.
                <br />
                3. Snap 1–2 photos of hardware condition before handoff or upon return.
              </p>
            </div>
          </div>

          {/* Right Column: Asset Details & Photo Inspection Engine */}
          <div className="lg:col-span-7">
            {lookupError && (
              <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{lookupError}</span>
              </div>
            )}

            {lookingUp ? (
              <div className="bg-white rounded-2xl border border-zinc-200/80 p-12 text-center text-zinc-400 text-xs">
                Querying asset database & loan verification logs...
              </div>
            ) : equipmentData ? (
              <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-2xs space-y-6 p-6">
                {/* Equipment Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-100 pb-5">
                  <div className="flex items-start space-x-3.5">
                    <img
                      src={equipmentData.image_url}
                      alt={equipmentData.name}
                      className="w-18 h-18 rounded-xl object-cover border border-zinc-200 shrink-0"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[11px] font-bold text-zinc-900 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded">
                          {equipmentData.asset_tag}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-semibold uppercase">
                          {equipmentData.category}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-zinc-950 mt-1">{equipmentData.name}</h2>
                      <p className="text-[11px] text-zinc-500">
                        S/N: {equipmentData.serial_number || 'N/A'} • Loc: {equipmentData.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${
                        equipmentData.status === 'AVAILABLE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : equipmentData.status === 'BORROWED'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      STATUS: {equipmentData.status}
                    </span>
                  </div>
                </div>

                {/* Overdue Alert Box if item is currently overdue */}
                {activeTransaction && (activeTransaction.status === 'OVERDUE' || new Date(activeTransaction.request_end_date) < new Date()) && (
                  <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex items-start space-x-2.5 text-rose-950 text-xs shadow-xs animate-in fade-in duration-150">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <span className="font-bold">OVERDUE RETURN NOTICE:</span> This item was due on{' '}
                      <strong>{new Date(activeTransaction.request_end_date).toLocaleString()}</strong> by{' '}
                      <strong>{activeTransaction.borrower_name}</strong>. Please perform thorough condition inspection.
                    </div>
                  </div>
                )}

                {/* Active Borrower Info (if borrowed) */}
                {activeTransaction && (
                  <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 flex items-center">
                      <User className="w-3 h-3 mr-1 text-zinc-600" />
                      Active Borrower Identification:
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-zinc-950">
                          {activeTransaction.borrower_name}
                        </span>
                        <span className="ml-2 font-mono text-zinc-500 text-[11px]">
                          ({activeTransaction.borrower_code || 'ID: ' + activeTransaction.borrower_id})
                        </span>
                        <div className="text-zinc-500 text-[11px] mt-0.5">{activeTransaction.borrower_email}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-500 text-[11px]">Due Deadline: </span>
                        <span className={`font-mono font-bold text-xs ${activeTransaction.status === 'OVERDUE' ? 'text-rose-600' : 'text-zinc-800'}`}>
                          {new Date(activeTransaction.request_end_date).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Workflow Selector: Check-Out vs Check-In */}
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setInspectionMode('CHECK_OUT')}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        inspectionMode === 'CHECK_OUT'
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      1. Check-Out Inspection (Pre-Handoff)
                    </button>

                    <button
                      type="button"
                      onClick={() => setInspectionMode('CHECK_IN')}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        inspectionMode === 'CHECK_IN'
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      2. Check-In Inspection (Return & Damage Log)
                    </button>
                  </div>

                  {/* Photo Damage Log Engine Component */}
                  <div className="border border-zinc-200/90 rounded-2xl p-4 bg-zinc-50/50">
                    <p className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-2 flex items-center">
                      <Camera className="w-3.5 h-3.5 mr-1 text-zinc-600" />
                      {inspectionMode === 'CHECK_OUT'
                        ? 'Check-Out Photo Inspection (Snap 1-2 pre-condition baseline photos)'
                        : 'Check-In Return Photo Verification & Damage Proof'}
                    </p>

                    <DamagePhotoUpload
                      photos={inspectionPhotos}
                      onPhotosChange={setInspectionPhotos}
                      isReturnInspection={inspectionMode === 'CHECK_IN'}
                      checkoutPhotos={baselinePhotos.filter((p) => p.photo_type === 'CHECK_OUT')}
                      damageState={damageState}
                      onDamageStateChange={setDamageState}
                    />

                    {/* Inspection Notes */}
                    <div className="mt-3.5">
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        Custodian Verification Notes:
                      </label>
                      <input
                        type="text"
                        value={inspectionNotes}
                        onChange={(e) => setInspectionNotes(e.target.value)}
                        placeholder={
                          inspectionMode === 'CHECK_OUT'
                            ? 'e.g. Clean casing, screen intact, charger included.'
                            : 'e.g. Item returned complete, verified operational.'
                        }
                        className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:outline-none bg-white"
                      />
                    </div>

                    {/* Process Action Button */}
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={handleProcessInspection}
                        disabled={processingInspection}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 ${
                          inspectionMode === 'CHECK_IN' && damageState.hasDamage
                            ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                            : 'bg-zinc-950 hover:bg-zinc-800 shadow-zinc-950/20'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {inspectionMode === 'CHECK_OUT'
                            ? 'Complete Check-Out & Release to Borrower'
                            : damageState.hasDamage
                            ? 'Confirm Return with Damage (Flag Under Repair)'
                            : 'Complete Clean Return & Mark Available'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-zinc-200/80 p-12 text-center text-zinc-400">
                <QrCode className="w-12 h-12 mx-auto mb-2.5 text-zinc-300" />
                <h3 className="font-semibold text-zinc-800 text-sm">Ready for Equipment Scan</h3>
                <p className="text-xs text-zinc-500 mt-0.5 max-w-sm mx-auto">
                  Use the camera scanner or tap any test tag on the left to pull up equipment details and process condition photos.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PENDING REQUESTS QUEUE */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-2xs">
          <div className="p-5 bg-zinc-950 text-white flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold">Pending Borrowing Requests Queue</h2>
              <p className="text-[11px] text-zinc-400">Review student & staff reservation requests and approve or reject based on availability</p>
            </div>
            <button
              onClick={loadPending}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-zinc-200 transition-colors cursor-pointer"
            >
              Refresh Queue
            </button>
          </div>

          {pendingLoading ? (
            <div className="p-10 text-center text-zinc-400 text-xs">Loading pending requests...</div>
          ) : pendingRequests.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <h4 className="font-semibold text-zinc-800 text-sm">Queue is clear!</h4>
              <p className="text-xs text-zinc-400 mt-0.5">There are no pending equipment reservation requests to review.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-5 hover:bg-zinc-50/70 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[11px] font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                          {req.asset_tag}
                        </span>
                        <h4 className="font-bold text-zinc-950 text-sm">{req.equipment_name}</h4>
                        <span className="text-[11px] text-zinc-400">({req.equipment_category})</span>
                      </div>

                      <div className="mt-1.5 text-xs space-y-0.5 text-zinc-600">
                        <p>
                          <strong>Borrower:</strong> {req.borrower_name} ({req.borrower_code || 'ID: ' + req.borrower_id}) • {req.borrower_email}
                        </p>
                        <p>
                          <strong>Period:</strong> {new Date(req.request_start_date).toLocaleString()} → {new Date(req.request_end_date).toLocaleString()}
                        </p>
                        <p className="text-zinc-800 bg-zinc-100 p-2 rounded-lg mt-1 font-medium text-[11px]">
                          <strong>Purpose:</strong> {req.purpose}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handleApprove(req.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-2xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Request</span>
                      </button>

                      <button
                        onClick={() => setRejectingId(rejectingId === req.id ? null : req.id)}
                        className="bg-zinc-100 hover:bg-rose-50 hover:text-rose-700 text-zinc-700 text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>

                  {/* Rejection Note */}
                  {rejectingId === req.id && (
                    <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                      <label className="block text-xs font-semibold text-rose-950">
                        Reason for Rejection (Visible to borrower):
                      </label>
                      <input
                        type="text"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="e.g. Reserved for scheduled laboratory class..."
                        className="w-full text-xs p-2 border border-rose-300 rounded-lg bg-white"
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setRejectingId(null)}
                          className="text-xs px-3 py-1 text-zinc-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="bg-rose-600 text-white text-xs font-semibold px-3 py-1 rounded-lg"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTIVE & OVERDUE LOANS MONITOR */}
      {activeTab === 'active-loans' && (
        <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-2xs">
          <div className="p-5 bg-zinc-950 text-white flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold">Active Checkouts & Overdue Tracking</h2>
              <p className="text-[11px] text-zinc-400">Live monitoring of borrowed assets with photo evidence comparison</p>
            </div>
            <button
              onClick={loadActiveLoans}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-zinc-200 transition-colors cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {activeLoansLoading ? (
            <div className="p-10 text-center text-zinc-400 text-xs">Loading active loans...</div>
          ) : activeLoans.length === 0 ? (
            <div className="p-10 text-center text-zinc-400 text-xs">No active equipment loans right now.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200/80 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Asset Tag & Item</th>
                    <th className="p-3.5">Borrower</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Deadline</th>
                    <th className="p-3.5">Photos</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {activeLoans.map((loan) => {
                    const isOverdue = loan.status === 'OVERDUE' || new Date(loan.request_end_date) < new Date();
                    return (
                      <tr key={loan.id} className={`hover:bg-zinc-50/70 ${isOverdue ? 'bg-rose-50/40' : ''}`}>
                        <td className="p-3.5">
                          <span className="font-mono font-bold text-zinc-900 block">{loan.asset_tag}</span>
                          <span className="text-zinc-600">{loan.equipment_name}</span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-zinc-900">{loan.borrower_name}</div>
                          <div className="text-zinc-400 font-mono text-[11px]">{loan.borrower_code || loan.borrower_email}</div>
                        </td>
                        <td className="p-3.5">
                          {isOverdue ? (
                            <span className="bg-rose-50 text-rose-700 border border-rose-300 px-2 py-0.5 rounded-md font-bold text-[10px] animate-pulse">
                              OVERDUE
                            </span>
                          ) : loan.status === 'CHECKED_OUT' ? (
                            <span className="bg-zinc-100 text-zinc-800 border border-zinc-200 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                              CHECKED OUT
                            </span>
                          ) : (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                              {loan.status}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-zinc-700">
                          <span className={isOverdue ? 'text-rose-600 font-bold' : ''}>
                            {new Date(loan.request_end_date).toLocaleString()}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded font-mono text-[10px]">
                            {loan.photos?.length || 0} photo(s)
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => openComparison(loan.id)}
                            className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2.5 py-1.5 rounded-lg font-semibold inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <SplitSquareVertical className="w-3.5 h-3.5" />
                            <span>Compare Proof</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveTab('scan');
                              handleTagScanned(loan.asset_tag);
                            }}
                            className="text-xs bg-zinc-950 hover:bg-zinc-800 text-white px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                          >
                            Check In / Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pre vs Post Comparison Modal */}
      {comparisonData && (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-zinc-200/90 my-8">
            <div className="p-4.5 bg-zinc-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center space-x-2">
                  <SplitSquareVertical className="w-4 h-4 text-zinc-400" />
                  <span>Pre & Post Photo Damage Inspection Comparison</span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Dispute Prevention Record #{comparisonData.transaction.id} • Asset: {comparisonData.transaction.asset_tag}
                </p>
              </div>
              <button
                onClick={() => setComparisonData(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Transaction details banner */}
              <div className="bg-zinc-50 border border-zinc-200/90 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-zinc-400 block text-[11px]">Equipment:</span>
                  <span className="font-bold text-zinc-950">{comparisonData.transaction.equipment_name}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[11px]">Borrower:</span>
                  <span className="font-bold text-zinc-950">{comparisonData.transaction.borrower_name}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[11px]">Check-Out Notes:</span>
                  <span className="text-zinc-700">{comparisonData.transaction.checkout_condition_notes || 'Clean'}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[11px]">Damage Status:</span>
                  <span className={`font-bold ${comparisonData.transaction.has_damage ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {comparisonData.transaction.has_damage ? `FLAGGED (${comparisonData.transaction.damage_severity})` : 'NO DAMAGE'}
                  </span>
                </div>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Check-out baseline */}
                <div className="border border-zinc-200/90 rounded-2xl p-4 bg-zinc-50/50">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-zinc-700 mb-2 flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-zinc-600" />
                    Pre-Checkout Baseline ({comparisonData.checkOutPhotos.length})
                  </h4>
                  {comparisonData.checkOutPhotos.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">No checkout photos uploaded.</p>
                  ) : (
                    <div className="space-y-3">
                      {comparisonData.checkOutPhotos.map((p) => (
                        <div key={p.id} className="rounded-xl overflow-hidden border border-zinc-200 bg-white shadow-2xs">
                          <img src={p.image_url} alt="Checkout baseline" className="w-full h-40 object-cover" />
                          <div className="p-2 text-xs text-zinc-700 font-medium">{p.caption || 'Checkout baseline'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Return condition */}
                <div className="border border-zinc-200/90 rounded-2xl p-4 bg-zinc-50/50">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-zinc-700 mb-2 flex items-center">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                    Post-Return Condition Proof ({comparisonData.checkInPhotos.length})
                  </h4>
                  {comparisonData.checkInPhotos.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">Item has not yet been returned or photographed.</p>
                  ) : (
                    <div className="space-y-3">
                      {comparisonData.checkInPhotos.map((p) => (
                        <div key={p.id} className="rounded-xl overflow-hidden border border-zinc-200 bg-white shadow-2xs">
                          <img src={p.image_url} alt="Return condition" className="w-full h-40 object-cover" />
                          <div className="p-2 text-xs text-zinc-700 font-medium">{p.caption || 'Return inspection photo'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end">
              <button
                onClick={() => setComparisonData(null)}
                className="bg-zinc-950 text-white text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
