import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { JWT_SECRET, authenticateToken, recordAuditLog } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await query.get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.is_active === 0) {
      return res.status(403).json({ error: 'This user account has been deactivated. Please contact an Administrator.' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Audit log
    await recordAuditLog(
      { user, headers: req.headers, socket: req.socket },
      'LOGIN',
      'USER',
      user.id,
      `User ${user.name} (${user.role}) logged in successfully`
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        student_or_staff_id: user.student_or_staff_id,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, department, student_or_staff_id, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = await query.get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'A user with this email address already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await query.run(
      `INSERT INTO users (name, email, password, role, department, student_or_staff_id, phone)
       VALUES (?, ?, ?, 'BORROWER', ?, ?, ?)`,
      [name.trim(), email.trim().toLowerCase(), hashedPassword, department || 'General', student_or_staff_id || '', phone || '']
    );

    const user = {
      id: result.lastID,
      name,
      email: email.trim().toLowerCase(),
      role: 'BORROWER',
      department,
      student_or_staff_id,
      phone
    };

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await recordAuditLog(
      { user, headers: req.headers, socket: req.socket },
      'REGISTER',
      'USER',
      user.id,
      `New user ${user.name} registered as BORROWER`
    );

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/quick-switch (Demo convenience to switch roles in 1-click)
router.post('/quick-switch', async (req, res) => {
  try {
    const { role } = req.body;
    let targetEmail = 'borrower@school.edu';
    if (role === 'ADMIN') targetEmail = 'admin@school.edu';
    else if (role === 'CUSTODIAN') targetEmail = 'custodian@school.edu';

    const user = await query.get('SELECT * FROM users WHERE email = ?', [targetEmail]);
    if (!user) {
      return res.status(404).json({ error: `Demo account for role ${role} not found` });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await recordAuditLog(
      { user, headers: req.headers, socket: req.socket },
      'ROLE_SWITCH_DEMO',
      'USER',
      user.id,
      `Instant demo switch to ${user.name} (${user.role})`
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        student_or_staff_id: user.student_or_staff_id,
        phone: user.phone
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to switch demo account' });
  }
});

export default router;
