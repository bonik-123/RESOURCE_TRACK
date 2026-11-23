import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Layers,
  Users,
  Database,
  Search,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  Trash2,
  Download,
  RefreshCw,
  Tag,
  Printer,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  FileSpreadsheet,
  MoreVertical,
  Check,
  X,
  Lock,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { adminService, equipmentService } from '../services/api';
import PrintableTags from '../components/PrintableTags';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

export default function AdminAuditLogs({ currentUser }) {
  const toast = useToast();

  // Tabs: 'inventory' | 'users' | 'audit' | 'system'
  const [activeTab, setActiveTab] = useState('inventory');

  // Inventory Management State
  const [equipmentList, setEquipmentList] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  // Add / Edit Equipment Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemFormData, setItemFormData] = useState({
    name: '',
    category: 'Laptops',
    model: '',
    serial_number: '',
    status: 'AVAILABLE',
    condition_notes: 'Pristine condition',
    location: 'Central IT Depot',
    custom_tag: '',
    image_url: '',
  });

  // Printable tags modal
  const [showPrintModal, setShowPrintModal] = useState(false);

  // User Management State
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'BORROWER',
    department: '',
    student_or_staff_id: '',
    phone: '',
  });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('All');
  const [auditRoleFilter, setAuditRoleFilter] = useState('All');

  // System & Backup State
  const [healthData, setHealthData] = useState(null);
  const [backupsList, setBackupsList] = useState([]);
  const [systemLoading, setSystemLoading] = useState(false);

  // Confirm Modal State
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    isDanger: false,
    isArchive: false,
    onConfirm: null,
  });

  // Load Inventory
  const loadInventory = async () => {
    try {
      setInventoryLoading(true);
      const res = await equipmentService.getAll({
        search: inventorySearch,
        category: selectedCategoryFilter,
        status: selectedStatusFilter,
        includeArchived: 'true',
      });
      setEquipmentList(res.data.items);
    } catch (err) {
      toast.error('Failed to load inventory records');
    } finally {
      setInventoryLoading(false);
    }
  };

  // Load Users
  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await adminService.getUsers();
      setUsersList(res.data);
    } catch (err) {
      toast.error('Failed to load user accounts');
    } finally {
      setUsersLoading(false);
    }
  };

  // Load Audit Logs
  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const res = await adminService.getAuditLogs({
        action: auditActionFilter,
        role: auditRoleFilter,
        search: auditSearch,
      });
      setAuditLogs(res.data);
    } catch (err) {
      toast.error('Failed to retrieve audit trail');
    } finally {
      setAuditLoading(false);
    }
  };

  // Load System Health & Backups
  const loadSystemInfo = async () => {
    try {
      setSystemLoading(true);
      const [healthRes, backupRes] = await Promise.all([
        adminService.getHealth(),
        adminService.getBackups(),
      ]);
      setHealthData(healthRes.data);
      setBackupsList(backupRes.data);
    } catch (err) {
      toast.error('Failed to retrieve system status');
    } finally {
      setSystemLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'inventory') loadInventory();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'audit') loadAuditLogs();
    if (activeTab === 'system') loadSystemInfo();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'inventory') loadInventory();
  }, [inventorySearch, selectedCategoryFilter, selectedStatusFilter]);

  useEffect(() => {
    if (activeTab === 'audit') loadAuditLogs();
  }, [auditSearch, auditActionFilter, auditRoleFilter]);

  // Handle Equipment Form Save (Add or Edit)
  const handleSaveEquipment = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await equipmentService.update(editingItem.id, itemFormData);
        toast.success(`Asset ${editingItem.asset_tag} updated successfully`);
      } else {
        const res = await equipmentService.create(itemFormData);
        toast.success(`Asset ${res.data.asset_tag} created with unique QR code`);
      }
      setShowItemModal(false);
      setEditingItem(null);
      loadInventory();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save equipment');
    }
  };

  // Handle Archive Equipment (Soft Delete)
  const handleArchive = (item) => {
    setConfirmState({
      isOpen: true,
      title: `Archive Asset ${item.asset_tag}?`,
      message: `Archiving will remove "${item.name}" from the active borrower catalog. Its transaction history and condition logs will be preserved. You can restore it anytime.`,
      confirmText: 'Archive Asset',
      isDanger: false,
      isArchive: true,
      onConfirm: async () => {
        try {
          await equipmentService.archive(item.id);
          toast.info(`Asset ${item.asset_tag} has been archived`);
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          loadInventory();
        } catch (err) {
          toast.error(err.response?.data?.error || 'Failed to archive item');
        }
      },
    });
  };

  // Handle Restore Equipment (From Archived back to Available)
  const handleRestore = async (item) => {
    try {
      await equipmentService.restore(item.id);
      toast.success(`Asset ${item.asset_tag} restored to AVAILABLE status`);
      loadInventory();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to restore equipment');
    }
  };

  // Handle Permanent Delete (Hard Delete)
  const handlePermanentDelete = (item) => {
    setConfirmState({
      isOpen: true,
      title: `Permanently Delete Asset ${item.asset_tag}?`,
      message: `CAUTION: This will permanently purge "${item.name}" and all its transaction history from the database. This action is irreversible.`,
      confirmText: 'Delete Permanently',
      isDanger: true,
      isArchive: false,
      onConfirm: async () => {
        try {
          await equipmentService.deletePermanent(item.id);
          toast.success(`Asset ${item.asset_tag} permanently purged from database`);
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          loadInventory();
        } catch (err) {
          toast.error(err.response?.data?.error || 'Failed to delete equipment');
        }
      },
    });
  };

  // Export Inventory CSV
  const handleExportInventoryCsv = async () => {
    try {
      const res = await equipmentService.exportCsv();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `equiptrack_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Inventory report exported as CSV');
    } catch (err) {
      toast.error('Failed to export CSV report');
    }
  };

  // Export Audit CSV
  const handleExportAuditCsv = async () => {
    try {
      const res = await adminService.exportAuditCsv();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `equiptrack_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Audit trail exported as CSV');
    } catch (err) {
      toast.error('Failed to export audit CSV');
    }
  };

  // User Save (Create or Edit)
  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await adminService.updateUser(editingUser.id, userFormData);
        toast.success(`User ${editingUser.name} updated successfully`);
      } else {
        await adminService.createUser(userFormData);
        toast.success(`User ${userFormData.name} created with role ${userFormData.role}`);
      }
      setShowUserModal(false);
      setEditingUser(null);
      setUserFormData({
        name: '',
        email: '',
        password: '',
        role: 'BORROWER',
        department: '',
        student_or_staff_id: '',
        phone: '',
      });
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save user account');
    }
  };

  // Delete User
  const handleDeleteUser = (user) => {
    setConfirmState({
      isOpen: true,
      title: `Delete User "${user.name}"?`,
      message: `Are you sure you want to delete this account (${user.email})? If this user has active loans, deletion will be blocked for safety.`,
      confirmText: 'Delete User',
      isDanger: true,
      isArchive: false,
      onConfirm: async () => {
        try {
          await adminService.deleteUser(user.id);
          toast.success(`User account "${user.name}" deleted`);
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          loadUsers();
        } catch (err) {
          toast.error(err.response?.data?.error || 'Failed to delete user');
        }
      },
    });
  };

  // User Active Status Toggle
  const handleToggleUser = async (userId, currentStatus) => {
    try {
      await adminService.toggleStatus(userId, !currentStatus);
      toast.info(`Account status ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle user status');
    }
  };

  // Trigger Database Backup
  const handleTriggerBackup = async () => {
    try {
      const res = await adminService.createBackup();
      toast.success(`Backup snapshot created: ${res.data.filename}`);
      loadSystemInfo();
    } catch (err) {
      toast.error('Failed to create database snapshot');
    }
  };

  // Run Overdue Daemon Routine
  const handleRunOverdueCheck = async () => {
    try {
      const res = await adminService.runOverdueCheck();
      toast.info(res.data.message);
      loadSystemInfo();
    } catch (err) {
      toast.error('Failed to run overdue checker');
    }
  };

  const getStatusBadge = (status) => {
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
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
            ARCHIVED
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/80 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-purple-50 text-purple-700 border border-purple-200/80 text-[11px] px-2.5 py-0.5 rounded-md font-semibold tracking-wide uppercase">
              Role 3: Administrator Console
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight mt-1.5">
            System Governance & Master Inventory
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Full inventory lifecycle (Add, Edit, Archive, Permanent Delete), RBAC accounts, and immutable audit verification.
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200/80 overflow-x-auto self-start md:self-auto max-w-full">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'inventory'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Master Inventory</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'users'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Governance</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'audit'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'system'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Backups & Health</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: MASTER INVENTORY (ADD, EDIT, ARCHIVE, DELETE) */}
      {/* ==================================================================== */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder="Search inventory by asset tag, name, model, serial, or depot location..."
                className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none transition-all placeholder:text-zinc-400"
              />
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="text-xs border border-zinc-200 rounded-xl px-3 py-2 bg-white text-zinc-700 focus:outline-none"
              >
                <option value="All">All Statuses (inc. Archived)</option>
                <option value="AVAILABLE">Available Only</option>
                <option value="BORROWED">Borrowed Only</option>
                <option value="UNDER_REPAIR">Under Repair</option>
                <option value="ARCHIVED">Archived Assets</option>
              </select>

              <button
                onClick={handleExportInventoryCsv}
                className="bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200/90 px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                title="Export equipment master record as CSV spreadsheet for panel audit"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-600" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setShowPrintModal(true)}
                className="bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200/90 px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-600" />
                <span>Print QR Tags</span>
              </button>

              <button
                onClick={() => {
                  setEditingItem(null);
                  setItemFormData({
                    name: '',
                    category: 'Laptops',
                    model: '',
                    serial_number: '',
                    status: 'AVAILABLE',
                    condition_notes: 'Pristine operational condition',
                    location: 'Central IT Depot Rack A1',
                    custom_tag: '',
                    image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
                  });
                  setShowItemModal(true);
                }}
                className="bg-zinc-950 hover:bg-zinc-800 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Equipment Asset</span>
              </button>
            </div>
          </div>

          {/* Master Table / Responsive Cards */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-2xs">
            {/* Desktop Table View */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200/80 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">QR Asset Tag</th>
                    <th className="p-3.5">Equipment Details</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Location</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Master Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {inventoryLoading ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-zinc-400">Loading master catalog...</td>
                    </tr>
                  ) : equipmentList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-zinc-500">
                        No equipment assets match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    equipmentList.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="p-3.5">
                          <span className="font-mono font-bold text-zinc-900 bg-zinc-100 border border-zinc-200/90 px-2 py-0.5 rounded text-[11px]">
                            {item.asset_tag}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-zinc-950">{item.name}</div>
                          <div className="text-zinc-500 text-[11px] mt-0.5">
                            Model: {item.model || 'Standard'} • S/N: {item.serial_number || 'N/A'}
                          </div>
                        </td>
                        <td className="p-3.5 text-zinc-600 font-medium">{item.category}</td>
                        <td className="p-3.5 text-zinc-600">{item.location || 'Depot'}</td>
                        <td className="p-3.5">{getStatusBadge(item.status)}</td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {/* Edit Button */}
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setItemFormData({
                                  name: item.name,
                                  category: item.category,
                                  model: item.model || '',
                                  serial_number: item.serial_number || '',
                                  status: item.status,
                                  condition_notes: item.condition_notes || '',
                                  location: item.location || '',
                                  custom_tag: item.asset_tag,
                                  image_url: item.image_url || '',
                                });
                                setShowItemModal(true);
                              }}
                              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit Equipment Record"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Archive vs Restore */}
                            {item.status === 'ARCHIVED' ? (
                              <button
                                onClick={() => handleRestore(item)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Restore Archived Asset to Available"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleArchive(item)}
                                disabled={item.status === 'BORROWED'}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                                title={item.status === 'BORROWED' ? 'Cannot archive while borrowed' : 'Archive Equipment Asset'}
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Permanent Delete */}
                            <button
                              onClick={() => handlePermanentDelete(item)}
                              disabled={item.status === 'BORROWED'}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                              title={item.status === 'BORROWED' ? 'Cannot delete while borrowed' : 'Permanent Hard Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-zinc-100">
              {equipmentList.map((item) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-zinc-900 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded text-[11px]">
                        {item.asset_tag}
                      </span>
                      <h4 className="font-bold text-zinc-900 text-sm mt-1">{item.name}</h4>
                      <p className="text-zinc-500 text-[11px]">{item.category} • {item.location}</p>
                    </div>
                    <div>{getStatusBadge(item.status)}</div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-50">
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setItemFormData({
                          name: item.name,
                          category: item.category,
                          model: item.model || '',
                          serial_number: item.serial_number || '',
                          status: item.status,
                          condition_notes: item.condition_notes || '',
                          location: item.location || '',
                          custom_tag: item.asset_tag,
                          image_url: item.image_url || '',
                        });
                        setShowItemModal(true);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-zinc-100 text-zinc-700 rounded-md"
                    >
                      Edit
                    </button>
                    {item.status === 'ARCHIVED' ? (
                      <button
                        onClick={() => handleRestore(item)}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-md"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => handleArchive(item)}
                        disabled={item.status === 'BORROWED'}
                        className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 rounded-md disabled:opacity-40"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      onClick={() => handlePermanentDelete(item)}
                      disabled={item.status === 'BORROWED'}
                      className="px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 rounded-md disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: USER GOVERNANCE & RBAC */}
      {/* ==================================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs">
            <div>
              <h3 className="font-bold text-sm text-zinc-950">User Governance & Access Roles</h3>
              <p className="text-xs text-zinc-500">Configure institutional accounts across Borrower, Custodian, and Admin tiers</p>
            </div>
            <button
              onClick={() => {
                setEditingUser(null);
                setUserFormData({
                  name: '',
                  email: '',
                  password: '',
                  role: 'BORROWER',
                  department: '',
                  student_or_staff_id: '',
                  phone: '',
                });
                setShowUserModal(true);
              }}
              className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200/80 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">ID / Code</th>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5">RBAC Role</th>
                    <th className="p-3.5">Account Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-zinc-400">Loading user accounts...</td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="p-3.5">
                          <div className="font-semibold text-zinc-950">{u.name}</div>
                          <div className="text-zinc-500 font-mono text-[11px]">{u.email}</div>
                        </td>
                        <td className="p-3.5 font-mono text-zinc-700">{u.student_or_staff_id || 'N/A'}</td>
                        <td className="p-3.5 text-zinc-600">{u.department || 'General'}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border tracking-wide uppercase ${
                              u.role === 'ADMIN'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : u.role === 'CUSTODIAN'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              u.is_active === 1
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {u.is_active === 1 ? 'ACTIVE' : 'DEACTIVATED'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setUserFormData({
                                  name: u.name,
                                  email: u.email,
                                  password: '',
                                  role: u.role,
                                  department: u.department || '',
                                  student_or_staff_id: u.student_or_staff_id || '',
                                  phone: u.phone || '',
                                });
                                setShowUserModal(true);
                              }}
                              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit User Profile"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleToggleUser(u.id, u.is_active === 1)}
                              disabled={currentUser?.id === u.id}
                              className={`px-2 py-1 text-[11px] rounded-md font-semibold transition-colors cursor-pointer disabled:opacity-30 ${
                                u.is_active === 1
                                  ? 'text-rose-600 hover:bg-rose-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {u.is_active === 1 ? 'Deactivate' : 'Activate'}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={currentUser?.id === u.id}
                              className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                              title={currentUser?.id === u.id ? 'Cannot delete self' : 'Delete User Account'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: AUDIT TRAIL & NON-REPUDIATION */}
      {/* ==================================================================== */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search audit trail by user, IP address, asset tag, or details..."
                className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="text-xs border border-zinc-200 rounded-xl px-2.5 py-2 bg-white text-zinc-700"
              >
                <option value="All">All Actions</option>
                <option value="LOGIN">LOGIN</option>
                <option value="CHECK_OUT">CHECK_OUT</option>
                <option value="CHECK_IN_DAMAGE">CHECK_IN_DAMAGE</option>
                <option value="CHECK_IN_CLEAN">CHECK_IN_CLEAN</option>
                <option value="CREATE_EQUIPMENT">CREATE_EQUIPMENT</option>
                <option value="UPDATE_EQUIPMENT">UPDATE_EQUIPMENT</option>
                <option value="ARCHIVE_EQUIPMENT">ARCHIVE_EQUIPMENT</option>
                <option value="PERMANENT_DELETE_EQUIPMENT">PERMANENT_DELETE_EQUIPMENT</option>
                <option value="OVERDUE_ALERT_DISPATCHED">OVERDUE_ALERT_DISPATCHED</option>
              </select>

              <button
                onClick={handleExportAuditCsv}
                className="bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200/90 px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-600" />
                <span>Export Audit CSV</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-200 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Action Event</th>
                    <th className="p-3.5">Actor & Role</th>
                    <th className="p-3.5">IP Address</th>
                    <th className="p-3.5">Verified Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono text-[11px]">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-zinc-400 font-sans">Querying tamper-evident audit records...</td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-zinc-500 font-sans">No audit records found matching your filters.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="p-3.5 text-zinc-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-tight ${
                              log.action.includes('DAMAGE')
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : log.action.includes('OVERDUE')
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : log.action.includes('DELETE')
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : log.action.includes('CHECK_OUT')
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-zinc-100 text-zinc-700'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3.5 font-sans">
                          <div className="font-semibold text-zinc-900 text-xs">{log.user_name}</div>
                          <div className="text-[10px] text-zinc-400 font-mono">{log.user_role}</div>
                        </td>
                        <td className="p-3.5 text-zinc-500">{log.ip_address}</td>
                        <td className="p-3.5 font-sans text-xs text-zinc-700 max-w-md">
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: SYSTEM HEALTH & SNAPSHOT BACKUPS */}
      {/* ==================================================================== */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {healthData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs">
                <span className="text-xs text-zinc-400">Database Engine</span>
                <p className="text-xs font-bold text-zinc-900 mt-1 font-mono">{healthData.system?.databaseEngine}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs">
                <span className="text-xs text-zinc-400">Active Borrowed Assets</span>
                <p className="text-2xl font-black text-amber-600 mt-0.5">{healthData.equipment?.borrowed}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs">
                <span className="text-xs text-zinc-400">Overdue Items Flagged</span>
                <p className="text-2xl font-black text-rose-600 mt-0.5">{healthData.transactions?.overdue}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs">
                <span className="text-xs text-zinc-400">System Status</span>
                <p className="text-xs font-bold text-emerald-600 mt-1 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  {healthData.system?.status}
                </p>
              </div>
            </div>
          )}

          {/* Maintenance Action Buttons */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-3">
            <h3 className="font-bold text-zinc-950 text-sm">Administrative Operations</h3>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={handleTriggerBackup}
                className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Create Database Snapshot Backup</span>
              </button>

              <button
                onClick={handleRunOverdueCheck}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Trigger Overdue Loan Verification Sweep</span>
              </button>
            </div>
          </div>

          {/* Backup Archives */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-2xs">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">Database Snapshot Archives</span>
              <span className="text-xs text-zinc-400 font-mono">{backupsList.length} archive(s)</span>
            </div>

            <div className="divide-y divide-zinc-100">
              {backupsList.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-xs">
                  No snapshot backups created yet. Click "Create Database Snapshot Backup" above.
                </div>
              ) : (
                backupsList.map((b) => (
                  <div key={b.filename} className="p-4 flex items-center justify-between text-xs hover:bg-zinc-50">
                    <div>
                      <div className="font-mono font-bold text-zinc-900">{b.filename}</div>
                      <div className="text-zinc-400 text-[11px] mt-0.5">
                        Size: {(b.sizeBytes / 1024).toFixed(1)} KB • Snapshot Date: {new Date(b.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <a
                      href={`/api/system/backups/${b.filename}`}
                      download
                      className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1 text-xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .db</span>
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* EQUIPMENT ADD / EDIT MODAL */}
      {/* ==================================================================== */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-zinc-200/90 my-8">
            <div className="p-4.5 bg-zinc-950 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingItem ? `Edit Equipment: ${editingItem.asset_tag}` : 'Add Equipment Asset to Master Catalog'}
              </h3>
              <button
                onClick={() => setShowItemModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEquipment} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Equipment Name *</label>
                <input
                  type="text"
                  required
                  value={itemFormData.name}
                  onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                  placeholder="e.g. Sony FX3 Cinema Camera Kit"
                  className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Category *</label>
                  <select
                    value={itemFormData.category}
                    onChange={(e) => setItemFormData({ ...itemFormData, category: e.target.value })}
                    className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl bg-white"
                  >
                    <option value="Laptops">Laptops</option>
                    <option value="Cameras">Cameras</option>
                    <option value="Projectors">Projectors</option>
                    <option value="Laboratory Tools">Laboratory Tools</option>
                    <option value="Audio/Visual">Audio/Visual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Asset Status</label>
                  <select
                    value={itemFormData.status}
                    onChange={(e) => setItemFormData({ ...itemFormData, status: e.target.value })}
                    className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl bg-white font-semibold"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="BORROWED">BORROWED</option>
                    <option value="UNDER_REPAIR">UNDER REPAIR</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Custom Asset Tag (Optional)</label>
                  <input
                    type="text"
                    value={itemFormData.custom_tag}
                    onChange={(e) => setItemFormData({ ...itemFormData, custom_tag: e.target.value })}
                    placeholder="Auto-generated if empty"
                    disabled={!!editingItem}
                    className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl font-mono uppercase disabled:bg-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={itemFormData.serial_number}
                    onChange={(e) => setItemFormData({ ...itemFormData, serial_number: e.target.value })}
                    placeholder="e.g. SNY-88219"
                    className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Model / Hardware Specs</label>
                <input
                  type="text"
                  value={itemFormData.model}
                  onChange={(e) => setItemFormData({ ...itemFormData, model: e.target.value })}
                  placeholder="e.g. Apple Silicon M3 Max / 36GB Unified Memory"
                  className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Depot Storage Location</label>
                <input
                  type="text"
                  value={itemFormData.location}
                  onChange={(e) => setItemFormData({ ...itemFormData, location: e.target.value })}
                  placeholder="e.g. Media Studio Locker 3"
                  className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Condition Baseline Notes</label>
                <textarea
                  rows={2}
                  value={itemFormData.condition_notes}
                  onChange={(e) => setItemFormData({ ...itemFormData, condition_notes: e.target.value })}
                  className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Equipment Image URL</label>
                <input
                  type="text"
                  value={itemFormData.image_url}
                  onChange={(e) => setItemFormData({ ...itemFormData, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-xs"
                >
                  {editingItem ? 'Save Changes' : 'Create & Auto-Generate QR Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* USER ADD / EDIT MODAL */}
      {/* ==================================================================== */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-zinc-200/90 my-8">
            <div className="p-4.5 bg-zinc-950 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingUser ? `Edit Account: ${editingUser.name}` : 'Create Institutional User Account'}
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  placeholder="e.g. Jordan Mitchell"
                  className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="jmitchell@school.edu"
                  className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  {editingUser ? 'New Password (Leave blank to keep unchanged)' : 'Initial Password *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Assigned Role *</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                    className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl bg-white font-semibold"
                  >
                    <option value="BORROWER">BORROWER</option>
                    <option value="CUSTODIAN">CUSTODIAN</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Student/Staff ID</label>
                  <input
                    type="text"
                    value={userFormData.student_or_staff_id}
                    onChange={(e) => setUserFormData({ ...userFormData, student_or_staff_id: e.target.value })}
                    placeholder="STU-2024-991"
                    className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Department</label>
                <input
                  type="text"
                  value={userFormData.department}
                  onChange={(e) => setUserFormData({ ...userFormData, department: e.target.value })}
                  placeholder="e.g. Media & Film Production"
                  className="w-full text-xs p-2.5 border border-zinc-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-xs"
                >
                  {editingUser ? 'Save Updates' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable QR Tags Modal */}
      {showPrintModal && (
        <PrintableTags
          items={equipmentList}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        isDanger={confirmState.isDanger}
        isArchive={confirmState.isArchive}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
