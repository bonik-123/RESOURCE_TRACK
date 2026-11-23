import jwt from 'jsonwebtoken';
import { query } from '../db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'equiptrack-super-secure-production-jwt-key-2026';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Access denied: Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await query.get('SELECT id, name, email, role, department, student_or_staff_id, is_active FROM users WHERE id = ?', [decoded.id]);

    if (!user || user.is_active === 0) {
      return res.status(403).json({ error: 'User account is deactivated or not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired authentication session' });
  }
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated user' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Permission denied: Role '${req.user.role}' cannot access this resource. Required roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

export async function recordAuditLog(req, action, entityType, entityId, details) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userId = req.user?.id || null;
    const userName = req.user?.name || 'Anonymous/System';
    const userRole = req.user?.role || 'SYSTEM';

    await query.run(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, ip_address, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, userName, userRole, action, entityType, String(entityId || ''), ip, details]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}
