import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { authenticateToken, authorizeRoles, recordAuditLog } from '../middleware/auth.js';

const router = express.Router();

// GET /api/users - Admin & Custodian list users
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'CUSTODIAN'), async (req, res) => {
  try {
    const users = await query.all(`
      SELECT id, name, email, role, department, student_or_staff_id, phone, is_active, created_at
      FROM users
      ORDER BY id ASC
    `);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

// POST /api/users - Admin create user
router.post('/', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { name, email, password, role, department, student_or_staff_id, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    if (!['BORROWER', 'CUSTODIAN', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Role must be BORROWER, CUSTODIAN, or ADMIN' });
    }

    const existing = await query.get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await query.run(`
      INSERT INTO users (name, email, password, role, department, student_or_staff_id, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name.trim(), email.trim().toLowerCase(), hashedPassword, role, department || '', student_or_staff_id || '', phone || '']);

    await recordAuditLog(
      req,
      'CREATE_USER',
      'USER',
      result.lastID,
      `Admin created user "${name.trim()}" (${email.trim()}) with role ${role}`
    );

    const newUser = await query.get('SELECT id, name, email, role, department, student_or_staff_id, phone, is_active, created_at FROM users WHERE id = ?', [result.lastID]);
    res.status(201).json(newUser);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Admin full update user profile
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { name, email, role, department, student_or_staff_id, phone, password } = req.body;
    const targetUser = await query.get('SELECT * FROM users WHERE id = ?', [req.params.id]);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check email uniqueness if email changed
    if (email && email.trim().toLowerCase() !== targetUser.email.toLowerCase()) {
      const emailClash = await query.get('SELECT id FROM users WHERE email = ? AND id != ?', [email.trim().toLowerCase(), req.params.id]);
      if (emailClash) {
        return res.status(400).json({ error: 'Another user already uses this email address' });
      }
    }

    const newRole = role || targetUser.role;
    let queryStr = `
      UPDATE users 
      SET name = ?, email = ?, role = ?, department = ?, student_or_staff_id = ?, phone = ?
    `;
    const params = [
      name?.trim() || targetUser.name,
      email?.trim().toLowerCase() || targetUser.email,
      newRole,
      department !== undefined ? department.trim() : targetUser.department,
      student_or_staff_id !== undefined ? student_or_staff_id.trim() : targetUser.student_or_staff_id,
      phone !== undefined ? phone.trim() : targetUser.phone
    ];

    if (password && password.trim().length > 0) {
      queryStr += `, password = ?`;
      params.push(bcrypt.hashSync(password.trim(), 10));
    }

    queryStr += ` WHERE id = ?`;
    params.push(req.params.id);

    await query.run(queryStr, params);

    await recordAuditLog(
      req,
      'UPDATE_USER',
      'USER',
      req.params.id,
      `Admin updated user account for "${name || targetUser.name}" (${email || targetUser.email}). Role: ${newRole}`
    );

    const updated = await query.get('SELECT id, name, email, role, department, student_or_staff_id, phone, is_active, created_at FROM users WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// PUT /api/users/:id/role - Admin change user role
router.put('/:id/role', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['BORROWER', 'CUSTODIAN', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    const targetUser = await query.get('SELECT id, name, role FROM users WHERE id = ?', [req.params.id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await query.run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);

    await recordAuditLog(
      req,
      'USER_ROLE_UPDATED',
      'USER',
      req.params.id,
      `Changed role of ${targetUser.name} from ${targetUser.role} to ${role}`
    );

    res.json({ message: `Role updated to ${role} successfully` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// PUT /api/users/:id/status - Admin toggle active/inactive
router.put('/:id/status', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { is_active } = req.body;
    const targetUser = await query.get('SELECT id, name, is_active FROM users WHERE id = ?', [req.params.id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.id === targetUser.id && !is_active) {
      return res.status(400).json({ error: 'Security restriction: You cannot deactivate your own active admin account.' });
    }

    const newStatus = is_active ? 1 : 0;
    await query.run('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);

    await recordAuditLog(
      req,
      newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      'USER',
      req.params.id,
      `${newStatus ? 'Activated' : 'Deactivated'} account for ${targetUser.name}`
    );

    res.json({ message: `User account ${newStatus ? 'activated' : 'deactivated'}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// DELETE /api/users/:id - Admin delete user (Safety defense check)
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const targetUser = await query.get('SELECT id, name, email, role FROM users WHERE id = ?', [req.params.id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.id === targetUser.id) {
      return res.status(400).json({ error: 'Security restriction: You cannot delete your own admin account.' });
    }

    // Check if user has active unreturned loans
    const activeLoan = await query.get(
      "SELECT id FROM transactions WHERE borrower_id = ? AND status IN ('CHECKED_OUT', 'OVERDUE')",
      [targetUser.id]
    );

    if (activeLoan) {
      return res.status(400).json({
        error: `Cannot delete user "${targetUser.name}" because they have unreturned equipment loans. Return equipment first.`
      });
    }

    // Cleanly delete user notifications and user
    await query.run('DELETE FROM system_notifications WHERE user_id = ?', [targetUser.id]);
    await query.run('DELETE FROM users WHERE id = ?', [targetUser.id]);

    await recordAuditLog(
      req,
      'DELETE_USER',
      'USER',
      req.params.id,
      `Deleted user account "${targetUser.name}" (${targetUser.email}, Role: ${targetUser.role})`
    );

    res.json({ message: `User account "${targetUser.name}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
