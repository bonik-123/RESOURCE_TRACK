
import React, { useState } from 'react';
import {
  Box,
  Lock,
  Mail,
  ArrowRight,
  Shield,
  AlertCircle,
  Package,
  ScanLine,
  CheckCircle2
} from 'lucide-react';
import { authService } from '../services/api';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [studentOrStaffId, setStudentOrStaffId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let res;

      if (isRegister) {
        res = await authService.register({
          name,
          email,
          password,
          department,
          student_or_staff_id: studentOrStaffId
        });
      } else {
        res = await authService.login(email, password);
      }

      localStorage.setItem('equiptrack_token', res.data.token);
      localStorage.setItem('equiptrack_user', JSON.stringify(res.data.user));
      onLoginSuccess(res.data.user);

    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Authentication failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role) => {
    setError('');
    setLoading(true);

    try {
      const res = await authService.quickSwitch(role);

      localStorage.setItem('equiptrack_token', res.data.token);
      localStorage.setItem('equiptrack_user', JSON.stringify(res.data.user));
      onLoginSuccess(res.data.user);

    } catch (err) {
      setError('Failed demo login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const demoRoles = [
    {
      role: 'BORROWER',
      label: 'Borrower',
      description: 'Student Access',
      color: '#0D9488'
    },
    {
      role: 'CUSTODIAN',
      label: 'Custodian',
      description: 'Lab Staff',
      color: '#3B82F6'
    },
    {
      role: 'ADMIN',
      label: 'Admin',
      description: 'IT Management',
      color: '#8B5CF6'
    }
  ];

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    color: '#142B45',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease'
  };

  const focusInput = (e) => {
    e.target.style.borderColor = '#0D9488';
    e.target.style.backgroundColor = '#FFFFFF';
    e.target.style.boxShadow = '0 0 0 3px rgba(13,148,136,0.10)';
  };

  const blurInput = (e) => {
    e.target.style.borderColor = '#E2E8F0';
    e.target.style.backgroundColor = '#F8FAFC';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex items-center justify-center p-4 sm:p-8">

      <div className="w-full max-w-6xl min-h-[680px] bg-white rounded-3xl overflow-hidden shadow-xl grid grid-cols-1 lg:grid-cols-2">

        {/* LEFT BRANDING PANEL */}
        <div
          className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #142B45 0%, #0B1B2B 100%)'
          }}
        >

          {/* Decorative background */}
          <div
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full"
            style={{
              background: 'rgba(13,148,136,0.13)',
              filter: 'blur(5px)'
            }}
          />

          <div
            className="absolute -bottom-40 -left-24 w-96 h-96 rounded-full"
            style={{
              background: 'rgba(240,180,41,0.08)',
              filter: 'blur(5px)'
            }}
          />

          {/* Brand */}
          <div className="relative z-10">

            <div className="flex items-center gap-3">

              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #0D9488, #14B8A6)',
                  boxShadow: '0 8px 25px rgba(13,148,136,0.3)'
                }}
              >
                <Package size={27} color="white" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  EquipTrack
                </h1>
                <p className="text-xs text-slate-400 tracking-wider">
                  ASSET MANAGEMENT SYSTEM
                </p>
              </div>

            </div>

          </div>

          {/* Main content */}
          <div className="relative z-10 max-w-md">

            <div
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full mb-7"
              style={{
                backgroundColor: 'rgba(13,148,136,0.15)',
                border: '1px solid rgba(45,212,191,0.2)'
              }}
            >
              <span className="w-2 h-2 rounded-full bg-teal-400" />
              <span className="text-xs font-semibold text-teal-300 tracking-wide">
                SMART EQUIPMENT MANAGEMENT
              </span>
            </div>

            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              Smarter Asset
              <br />
              Management.
              <br />
              <span style={{ color: '#2DD4BF' }}>
                Better Control.
              </span>
            </h2>

            <p className="text-slate-300 text-base leading-relaxed mb-10">
              A centralized platform for managing school and office
              equipment. Track assets, simplify borrowing, and
              maintain accountability with QR-powered technology.
            </p>

            {/* Features */}
            <div className="space-y-5">

              {[
                {
                  icon: ScanLine,
                  title: 'QR Code Asset Tracking',
                  description: 'Quick identification and equipment monitoring.'
                },
                {
                  icon: Shield,
                  title: 'Secure Access Control',
                  description: 'Role-based permissions and account protection.'
                },
                {
                  icon: CheckCircle2,
                  title: 'Borrowing Management',
                  description: 'Organized equipment requests and transactions.'
                }
              ].map((feature, index) => {
                const Icon = feature.icon;

                return (
                  <div key={index} className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        color: '#2DD4BF'
                      }}
                    >
                      <Icon size={20} />
                    </div>

                    <div>
                      <h3 className="text-white font-semibold text-sm">
                        {feature.title}
                      </h3>
                      <p className="text-slate-400 text-xs mt-1">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}

            </div>

          </div>

          {/* Footer */}
          <div className="relative z-10 border-t border-white/10 pt-6">
            <p className="text-xs text-slate-400">
              EQUIPTRACK © {new Date().getFullYear()} · School & Office Equipment Management
            </p>
          </div>

        </div>

        {/* RIGHT LOGIN PANEL */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-14">

          {/* Mobile branding */}
          <div className="flex items-center justify-center gap-3 mb-9 lg:hidden">

            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: '#0D9488' }}
            >
              <Package size={25} color="white" />
            </div>

            <div>
              <h1 className="text-xl font-bold text-[#142B45]">
                EquipTrack
              </h1>
              <p className="text-[10px] text-slate-500 tracking-wider">
                ASSET MANAGEMENT SYSTEM
              </p>
            </div>

          </div>

          {/* Heading */}
          <div className="mb-8">

            <div
              className="w-12 h-1 rounded-full mb-5"
              style={{ backgroundColor: '#0D9488' }}
            />

            <h2 className="text-3xl font-bold text-[#142B45] tracking-tight">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h2>

            <p className="text-sm text-slate-500 mt-2">
              {isRegister
                ? 'Register to access the EquipTrack platform.'
                : 'Sign in to continue to your EquipTrack workspace.'}
            </p>

          </div>

          {/* Error message */}
          {error && (
            <div
              className="mb-5 p-4 rounded-xl flex items-start gap-3 text-sm"
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#B91C1C'
              }}
            >
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Demo accounts */}
          {!isRegister && (
            <div
              className="mb-7 p-4 rounded-2xl"
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0'
              }}
            >

              <div className="flex items-center justify-between mb-4">

                <div>
                  <h3 className="text-sm font-bold text-[#142B45]">
                    Quick Demo Access
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Explore the system using demo accounts.
                  </p>
                </div>

                <div
                  className="text-[10px] font-semibold px-2 py-1 rounded-md"
                  style={{
                    backgroundColor: '#CCFBF1',
                    color: '#0F766E'
                  }}
                >
                  DEMO
                </div>

              </div>

              <div className="grid grid-cols-3 gap-2">

                {demoRoles.map((item) => (
                  <button
                    key={item.role}
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemoLogin(item.role)}
                    className="rounded-xl p-3 text-center transition-all hover:-translate-y-0.5 disabled:opacity-50"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = item.color;
                      e.currentTarget.style.boxShadow = `0 4px 12px ${item.color}20`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >

                    <div
                      className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center"
                      style={{
                        backgroundColor: `${item.color}15`,
                        color: item.color
                      }}
                    >
                      <Shield size={17} />
                    </div>

                    <div className="text-xs font-bold text-[#142B45]">
                      {item.label}
                    </div>

                    <div className="text-[9px] text-slate-500 mt-1">
                      {item.description}
                    </div>

                  </button>
                ))}

              </div>
            </div>
          )}

          {/* Divider */}
          {!isRegister && (
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] text-slate-400 font-medium">
                OR SIGN IN WITH EMAIL
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          )}

          {/* Authentication form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-2">
                    Full Name
                  </label>

                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    style={inputStyle}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-2">
                      Department
                    </label>

                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Your department"
                      style={inputStyle}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-2">
                      Student / Staff ID
                    </label>

                    <input
                      type="text"
                      value={studentOrStaffId}
                      onChange={(e) => setStudentOrStaffId(e.target.value)}
                      placeholder="e.g. STU-9921"
                      style={inputStyle}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />
                  </div>

                </div>
              </>
            )}

            {/* Email */}
            <div>

              <label className="block text-xs font-semibold text-[#334155] mb-2">
                Institutional Email
              </label>

              <div className="relative">

                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: '#94A3B8' }}
                />

                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@school.edu"
                  style={{ ...inputStyle, paddingLeft: '46px' }}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />

              </div>
            </div>

            {/* Password */}
            <div>

              <label className="block text-xs font-semibold text-[#334155] mb-2">
                Password
              </label>

              <div className="relative">

                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: '#94A3B8' }}
                />

                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{ ...inputStyle, paddingLeft: '46px' }}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />

              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
                boxShadow: '0 6px 18px rgba(13,148,136,0.22)'
              }}
            >

              <span>
                {loading
                  ? 'Please wait...'
                  : isRegister
                    ? 'Create Account'
                    : 'Sign In to EquipTrack'}
              </span>

              {!loading && <ArrowRight size={18} />}

            </button>

          </form>

          {/* Register toggle */}
          <div className="mt-7 text-center">

            <p className="text-sm text-slate-500">

              {isRegister
                ? 'Already have an account?'
                : "Don't have an account yet?"}

              {' '}

              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError('');
                }}
                className="font-bold transition-colors"
                style={{ color: '#0D9488' }}
              >
                {isRegister ? 'Sign In' : 'Register as Borrower'}
              </button>

            </p>

          </div>

          {/* Security footer */}
          <div className="mt-10 pt-6 border-t border-slate-100">

            <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">

              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Shield size={13} className="text-teal-600" />
                RBAC Protected
              </div>

              <span className="text-slate-300">•</span>

              <span className="text-[10px] text-slate-500">
                Bcrypt Password Hashing
              </span>

              <span className="text-slate-300">•</span>

              <span className="text-[10px] text-slate-500">
                Audit Logged
              </span>

            </div>

            <p className="text-center text-[10px] text-slate-400 mt-4">
              © {new Date().getFullYear()} EquipTrack. All rights reserved.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}
