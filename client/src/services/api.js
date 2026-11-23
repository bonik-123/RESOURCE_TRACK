import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
});

// Attach JWT token from localStorage to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('equiptrack_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response error handler
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (error.response.data?.error?.includes('expired') || error.response.status === 401) {
        localStorage.removeItem('equiptrack_token');
        localStorage.removeItem('equiptrack_user');
      }
    }
    return Promise.reject(error);
  }
);

// Auth Service
export const authService = {
  login: (email, password) => API.post('/auth/login', { email, password }),
  register: (userData) => API.post('/auth/register', userData),
  getMe: () => API.get('/auth/me'),
  quickSwitch: (role) => API.post('/auth/quick-switch', { role }),
};

// Equipment Service
export const equipmentService = {
  getAll: (params) => API.get('/equipment', { params }),
  getCategories: () => API.get('/equipment/categories'),
  getByTag: (tag) => API.get(`/equipment/tag/${tag}`),
  getById: (id) => API.get(`/equipment/${id}`),
  create: (data) => API.post('/equipment', data),
  update: (id, data) => API.put(`/equipment/${id}`, data),
  archive: (id) => API.post(`/equipment/${id}/archive`),
  restore: (id) => API.post(`/equipment/${id}/restore`),
  deletePermanent: (id) => API.delete(`/equipment/${id}`),
  exportCsv: () => API.get('/equipment/export/csv', { responseType: 'blob' }),
};

// Borrow / Loan Service
export const borrowService = {
  requestLoan: (data) => API.post('/borrow/request', data),
  getMyLoans: () => API.get('/borrow/my-loans'),
  getPending: () => API.get('/borrow/pending'),
  approve: (id) => API.post(`/borrow/${id}/approve`),
  reject: (id, reason) => API.post(`/borrow/${id}/reject`, { reason }),
  getActiveLoans: () => API.get('/borrow/active'),
  getOverdueStatus: () => API.get('/borrow/overdue-status'),
};

// Check-In / Check-Out & Photo Inspection Service
export const checkService = {
  checkout: (formData) =>
    API.post('/check/checkout', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  checkin: (formData) =>
    API.post('/check/checkin', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getComparison: (transactionId) => API.get(`/check/compare/${transactionId}`),
};

// Admin & Security Audit Service
export const adminService = {
  getAuditLogs: (params) => API.get('/audit-logs', { params }),
  exportAuditCsv: () => API.get('/audit-logs/export/csv', { responseType: 'blob' }),
  getUsers: () => API.get('/users'),
  createUser: (data) => API.post('/users', data),
  updateUser: (id, data) => API.put(`/users/${id}`, data),
  updateRole: (id, role) => API.put(`/users/${id}/role`, { role }),
  toggleStatus: (id, is_active) => API.put(`/users/${id}/status`, { is_active }),
  deleteUser: (id) => API.delete(`/users/${id}`),
  getHealth: () => API.get('/system/health'),
  createBackup: () => API.post('/system/backup'),
  getBackups: () => API.get('/system/backups'),
  runOverdueCheck: () => API.post('/system/trigger-overdue-check'),
};

export default API;
