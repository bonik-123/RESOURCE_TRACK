import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import EquipmentCatalog from './pages/EquipmentCatalog';
import CustodianCheck from './pages/CustodianCheck';
import AdminAuditLogs from './pages/AdminAuditLogs';
import { authService } from './services/api';
import { ToastProvider } from './components/Toast';

// Protected Route Component with RBAC checks
function ProtectedRoute({ user, allowedRoles, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'CUSTODIAN') return <Navigate to="/custodian" replace />;
    return <Navigate to="/catalog" replace />;
  }

  return children;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('equiptrack_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('equiptrack_token');
      if (token) {
        try {
          const res = await authService.getMe();
          setCurrentUser(res.data.user);
          localStorage.setItem('equiptrack_user', JSON.stringify(res.data.user));
        } catch (err) {
          localStorage.removeItem('equiptrack_token');
          localStorage.removeItem('equiptrack_user');
          setCurrentUser(null);
        }
      }
      setCheckingAuth(false);
    };

    verifyAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('equiptrack_token');
    localStorage.removeItem('equiptrack_user');
    setCurrentUser(null);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-zinc-400">Loading EquipTrack Session...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <div className="min-h-screen bg-[#fafafc] flex flex-col font-sans selection:bg-zinc-900 selection:text-white">
          {currentUser && (
            <Navbar
              currentUser={currentUser}
              onRoleSwitched={(newUser) => setCurrentUser(newUser)}
              onLogout={handleLogout}
            />
          )}

          <main className="flex-1">
            <Routes>
              <Route
                path="/login"
                element={
                  currentUser ? (
                    <Navigate
                      to={
                        currentUser.role === 'ADMIN'
                          ? '/admin'
                          : currentUser.role === 'CUSTODIAN'
                          ? '/custodian'
                          : '/catalog'
                      }
                      replace
                    />
                  ) : (
                    <Login onLoginSuccess={(user) => setCurrentUser(user)} />
                  )
                }
              />

              {/* Catalog: accessible to all authenticated roles */}
              <Route
                path="/catalog"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['BORROWER', 'CUSTODIAN', 'ADMIN']}>
                    <EquipmentCatalog currentUser={currentUser} />
                  </ProtectedRoute>
                }
              />

              {/* Custodian: accessible to Custodians and Admins */}
              <Route
                path="/custodian"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['CUSTODIAN', 'ADMIN']}>
                    <CustodianCheck currentUser={currentUser} />
                  </ProtectedRoute>
                }
              />

              {/* Admin: accessible only to Admins */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['ADMIN']}>
                    <AdminAuditLogs currentUser={currentUser} />
                  </ProtectedRoute>
                }
              />

              {/* Root redirect */}
              <Route
                path="*"
                element={
                  <Navigate
                    to={
                      !currentUser
                        ? '/login'
                        : currentUser.role === 'ADMIN'
                        ? '/admin'
                        : currentUser.role === 'CUSTODIAN'
                        ? '/custodian'
                        : '/catalog'
                    }
                    replace
                  />
                }
              />
            </Routes>
          </main>
        </div>
      </Router>
    </ToastProvider>
  );
}
