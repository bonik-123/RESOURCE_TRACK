import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Layers,
  Box,
  QrCode,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Sparkles,
  Menu,
  X,
  AlertTriangle,
} from 'lucide-react';
import { authService, borrowService } from '../services/api';
import { useToast } from './Toast';

export default function Navbar({ currentUser, onRoleSwitched, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [overdueInfo, setOverdueInfo] = useState({ hasOverdue: false, count: 0, items: [] });

  const role = currentUser?.role || 'BORROWER';

  const loadOverdueStatus = async () => {
    try {
      const res = await borrowService.getOverdueStatus();
      setOverdueInfo(res.data);
    } catch (err) {
      // silently ignore
    }
  };

  useEffect(() => {
    loadOverdueStatus();
    const interval = setInterval(loadOverdueStatus, 25000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleQuickSwitch = async (targetRole) => {
    try {
      setSwitching(true);
      const res = await authService.quickSwitch(targetRole);
      localStorage.setItem('equiptrack_token', res.data.token);
      localStorage.setItem('equiptrack_user', JSON.stringify(res.data.user));
      onRoleSwitched(res.data.user);
      setDropdownOpen(false);
      setMobileMenuOpen(false);
      toast.success(`Switched role to ${targetRole}`);
      if (targetRole === 'ADMIN') navigate('/admin');
      else if (targetRole === 'CUSTODIAN') navigate('/custodian');
      else navigate('/catalog');
    } catch (err) {
      toast.error('Failed to switch role');
    } finally {
      setSwitching(false);
    }
  };

  const getRoleBadge = (r) => {
    switch (r) {
      case 'ADMIN': return { bg: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: 'rgba(139,92,246,0.4)' };
      case 'CUSTODIAN': return { bg: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: 'rgba(59,130,246,0.4)' };
      default: return { bg: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: 'rgba(16,185,129,0.4)' };
    }
  };

  const handleOverdueClick = () => {
    if (role === 'BORROWER') navigate('/catalog?tab=my-loans');
    else if (role === 'CUSTODIAN') navigate('/custodian?tab=active-loans');
    else navigate('/admin?tab=system');
  };

  const isActive = (path) => location.pathname === path;
  const badge = getRoleBadge(role);

  return (
    <header
      className="sticky top-0 z-40 no-print transition-all"
      style={{
        backgroundColor: '#11212D',
        borderBottom: '1px solid #253745',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo & Nav */}
          <div className="flex items-center space-x-6 sm:space-x-8">
            <Link to="/catalog" className="flex items-center space-x-3 group">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200"
                style={{ background: 'linear-gradient(135deg, #253745, #4A5C6A)' }}
              >
                <Box className="w-4 h-4" style={{ color: '#CCD0CF' }} />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight block" style={{ color: '#CCD0CF' }}>
                  EquipTrack
                </span>
                <span className="block text-[10px] font-medium tracking-wide -mt-1" style={{ color: '#9BA8AB' }}>
                  Institutional Asset Verification
                </span>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center space-x-1">
              <Link
                to="/catalog"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center space-x-1.5"
                style={{
                  backgroundColor: isActive('/catalog') ? '#253745' : 'transparent',
                  color: isActive('/catalog') ? '#CCD0CF' : '#9BA8AB',
                  border: isActive('/catalog') ? '1px solid #4A5C6A' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!isActive('/catalog')) { e.currentTarget.style.backgroundColor = 'rgba(37,55,69,0.5)'; e.currentTarget.style.color = '#CCD0CF'; }}}
                onMouseLeave={e => { if (!isActive('/catalog')) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9BA8AB'; }}}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Equipment Catalog</span>
              </Link>

              {(role === 'CUSTODIAN' || role === 'ADMIN') && (
                <Link
                  to="/custodian"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center space-x-1.5"
                  style={{
                    backgroundColor: isActive('/custodian') ? '#253745' : 'transparent',
                    color: isActive('/custodian') ? '#CCD0CF' : '#9BA8AB',
                    border: isActive('/custodian') ? '1px solid #4A5C6A' : '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isActive('/custodian')) { e.currentTarget.style.backgroundColor = 'rgba(37,55,69,0.5)'; e.currentTarget.style.color = '#CCD0CF'; }}}
                  onMouseLeave={e => { if (!isActive('/custodian')) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9BA8AB'; }}}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Custodian Desk & Scanning</span>
                </Link>
              )}

              {role === 'ADMIN' && (
                <Link
                  to="/admin"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center space-x-1.5"
                  style={{
                    backgroundColor: isActive('/admin') ? '#253745' : 'transparent',
                    color: isActive('/admin') ? '#CCD0CF' : '#9BA8AB',
                    border: isActive('/admin') ? '1px solid #4A5C6A' : '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isActive('/admin')) { e.currentTarget.style.backgroundColor = 'rgba(37,55,69,0.5)'; e.currentTarget.style.color = '#CCD0CF'; }}}
                  onMouseLeave={e => { if (!isActive('/admin')) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9BA8AB'; }}}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin & Audit Hub</span>
                </Link>
              )}
            </nav>
          </div>

          {/* Right Area */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* Overdue Indicator */}
            {overdueInfo.hasOverdue && (
              <button
                onClick={handleOverdueClick}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer animate-soft-pulse"
                style={{
                  backgroundColor: 'rgba(244,63,94,0.15)',
                  color: '#fca5a5',
                  borderColor: 'rgba(244,63,94,0.4)',
                }}
                title={
                  role === 'BORROWER'
                    ? `You have ${overdueInfo.count} past-due loan(s)! Click to view.`
                    : `${overdueInfo.count} overdue loan(s) across institution. Click to review.`
                }
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span className="text-[11px]">
                  {role === 'BORROWER'
                    ? `${overdueInfo.count} Overdue Item${overdueInfo.count > 1 ? 's' : ''}!`
                    : `${overdueInfo.count} Overdue Loan${overdueInfo.count > 1 ? 's' : ''}`}
                </span>
              </button>
            )}

            {/* Role Switcher */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                disabled={switching}
                className="flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: '#253745',
                  border: '1px solid #4A5C6A',
                  color: '#CCD0CF',
                }}
                title="Switch role for demo"
              >
                <span
                  className="px-2 py-0.5 rounded-md font-bold text-[10px] tracking-wide uppercase"
                  style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
                >
                  {role}
                </span>
                <span className="hidden sm:inline font-semibold text-xs" style={{ color: '#CCD0CF' }}>
                  {currentUser?.name?.split(' ')[0]}
                </span>
                <ChevronDown className="w-3 h-3" style={{ color: '#9BA8AB' }} />
              </button>

              {dropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl py-2.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                  style={{ backgroundColor: '#11212D', border: '1px solid #253745' }}
                >
                  <div className="px-4 py-2" style={{ borderBottom: '1px solid #253745' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#4A5C6A' }}>Active Account</p>
                    <p className="text-xs font-bold truncate mt-0.5" style={{ color: '#CCD0CF' }}>{currentUser?.name}</p>
                    <p className="text-[11px] truncate" style={{ color: '#9BA8AB' }}>{currentUser?.email}</p>
                  </div>

                  {overdueInfo.hasOverdue && (
                    <div
                      onClick={handleOverdueClick}
                      className="mx-3 my-2 p-2 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors"
                      style={{ backgroundColor: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#fca5a5' }}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="font-semibold text-[11px]">
                        {role === 'BORROWER'
                          ? `You have ${overdueInfo.count} past-due equipment loan!`
                          : `${overdueInfo.count} overdue loan(s) in circulation.`}
                      </span>
                    </div>
                  )}

                  <div className="px-3 py-2" style={{ borderBottom: '1px solid #253745' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center" style={{ color: '#9BA8AB' }}>
                      <Sparkles className="w-3 h-3 mr-1" style={{ color: '#4A5C6A' }} />
                      Role Quick Switch (1-Click):
                    </p>
                    <div className="space-y-1">
                      {[
                        { r: 'BORROWER', label: 'Student / Borrower', tag: 'BORROWER', accent: { bg: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: 'rgba(16,185,129,0.3)' } },
                        { r: 'CUSTODIAN', label: 'Lab Custodian', tag: 'CUSTODIAN', accent: { bg: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: 'rgba(59,130,246,0.3)' } },
                        { r: 'ADMIN', label: 'IT Administrator', tag: 'ADMIN', accent: { bg: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: 'rgba(139,92,246,0.3)' } },
                      ].map(({ r, label, tag, accent }) => (
                        <button
                          key={r}
                          onClick={() => handleQuickSwitch(r)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors"
                          style={{
                            backgroundColor: role === r ? '#253745' : 'transparent',
                            color: role === r ? '#CCD0CF' : '#9BA8AB',
                          }}
                          onMouseEnter={e => { if (role !== r) { e.currentTarget.style.backgroundColor = '#253745'; e.currentTarget.style.color = '#CCD0CF'; }}}
                          onMouseLeave={e => { if (role !== r) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9BA8AB'; }}}
                        >
                          <span>{label}</span>
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold"
                            style={{ backgroundColor: accent.bg, color: accent.color, border: `1px solid ${accent.border}` }}
                          >
                            {tag}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-1.5 px-2">
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-3 py-1.5 text-xs font-medium rounded-lg flex items-center space-x-2 transition-colors cursor-pointer"
                      style={{ color: '#f87171' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(244,63,94,0.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl transition-colors cursor-pointer"
              style={{ color: '#9BA8AB' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#253745'; e.currentTarget.style.color = '#CCD0CF'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9BA8AB'; }}
              title="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div
            className="md:hidden py-3 px-2 space-y-1 animate-in slide-in-from-top-2 duration-150"
            style={{ borderTop: '1px solid #253745' }}
          >
            {[
              { to: '/catalog', label: 'Equipment Catalog & Reservations', show: true },
              { to: '/custodian', label: 'Custodian Desk & QR Scanning', show: role === 'CUSTODIAN' || role === 'ADMIN' },
              { to: '/admin', label: 'Admin Hub & Audit Logs', show: role === 'ADMIN' },
            ].filter(l => l.show).map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: location.pathname === to ? '#253745' : 'transparent',
                  color: location.pathname === to ? '#CCD0CF' : '#9BA8AB',
                  border: location.pathname === to ? '1px solid #4A5C6A' : '1px solid transparent',
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
