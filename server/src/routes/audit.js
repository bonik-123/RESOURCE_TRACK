import express from 'express';
import { query } from '../db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// GET /api/audit-logs - Admin Security Monitoring & Audit Trail
router.get('/', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { action, role, search, limit = 100 } = req.query;
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (action && action !== 'All') {
      sql += ' AND action = ?';
      params.push(action);
    }

    if (role && role !== 'All') {
      sql += ' AND user_role = ?';
      params.push(role);
    }

    if (search) {
      const s = `%${search.trim()}%`;
      sql += ' AND (user_name LIKE ? OR details LIKE ? OR entity_id LIKE ? OR ip_address LIKE ? OR action LIKE ?)';
      params.push(s, s, s, s, s);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const logs = await query.all(sql, params);
    res.json(logs);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

// GET /api/audit-logs/export/csv - Export audit logs to CSV for compliance and panelists
router.get('/export/csv', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const logs = await query.all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500');

    const headers = ['Log ID', 'Timestamp', 'User ID', 'User Name', 'Role', 'Action Event', 'Entity Type', 'Entity ID', 'IP Address', 'Details'];
    const rows = logs.map(l => [
      l.id,
      `"${l.timestamp}"`,
      l.user_id || 'SYSTEM',
      `"${(l.user_name || '').replace(/"/g, '""')}"`,
      l.user_role || 'SYSTEM',
      `"${l.action || ''}"`,
      `"${l.entity_type || ''}"`,
      `"${l.entity_id || ''}"`,
      `"${l.ip_address || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="equiptrack_audit_trail_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export audit logs CSV' });
  }
});

export default router;
