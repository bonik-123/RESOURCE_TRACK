import express from 'express';
import { query } from '../db.js';
import { authenticateToken, authorizeRoles, recordAuditLog } from '../middleware/auth.js';
import { checkOverdueItems } from './system.js';

const router = express.Router();

// GET /api/borrow/overdue-status - Real-time overdue indicator for all 3 roles
router.get('/overdue-status', authenticateToken, async (req, res) => {
  try {
    // Run real-time check so overdue statuses are always fresh
    await checkOverdueItems();

    const now = new Date().toISOString();

    if (req.user.role === 'BORROWER') {
      // Borrower: Only their personal overdue loans
      const myOverdue = await query.all(`
        SELECT t.*, e.name as equipment_name, e.asset_tag, e.category as equipment_category, e.location, e.image_url
        FROM transactions t
        JOIN equipment e ON t.equipment_id = e.id
        WHERE t.borrower_id = ? AND (t.status = 'OVERDUE' OR (t.status = 'CHECKED_OUT' AND t.request_end_date < ?))
        ORDER BY t.request_end_date ASC
      `, [req.user.id, now]);

      return res.json({
        role: 'BORROWER',
        hasOverdue: myOverdue.length > 0,
        count: myOverdue.length,
        items: myOverdue,
      });
    } else {
      // Custodian & Admin: Global institutional overdue status
      const allOverdue = await query.all(`
        SELECT t.*, 
               e.name as equipment_name, e.asset_tag, e.category as equipment_category, e.location, e.image_url,
               u.name as borrower_name, u.email as borrower_email, u.student_or_staff_id as borrower_code, u.phone as borrower_phone, u.department as borrower_department
        FROM transactions t
        JOIN equipment e ON t.equipment_id = e.id
        JOIN users u ON t.borrower_id = u.id
        WHERE t.status = 'OVERDUE' OR (t.status = 'CHECKED_OUT' AND t.request_end_date < ?)
        ORDER BY t.request_end_date ASC
      `, [now]);

      return res.json({
        role: req.user.role,
        hasOverdue: allOverdue.length > 0,
        count: allOverdue.length,
        items: allOverdue,
      });
    }
  } catch (err) {
    console.error('Error fetching overdue status:', err);
    res.status(500).json({ error: 'Failed to retrieve overdue status' });
  }
});

// POST /api/borrow/request - Borrowers submit a reservation request
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const { equipment_id, request_start_date, request_end_date, purpose } = req.body;

    if (!equipment_id || !request_start_date || !request_end_date || !purpose) {
      return res.status(400).json({ error: 'Equipment ID, Start Date, End Date, and Purpose are required' });
    }

    const startDate = new Date(request_start_date);
    const endDate = new Date(request_end_date);
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'Return deadline must be after the start date' });
    }

    const equipment = await query.get('SELECT * FROM equipment WHERE id = ?', [equipment_id]);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    if (equipment.status === 'UNDER_REPAIR' || equipment.status === 'ARCHIVED') {
      return res.status(400).json({ error: `Equipment cannot be requested because it is ${equipment.status}` });
    }

    const result = await query.run(`
      INSERT INTO transactions (equipment_id, borrower_id, status, purpose, request_start_date, request_end_date)
      VALUES (?, ?, 'PENDING', ?, ?, ?)
    `, [equipment_id, req.user.id, purpose.trim(), request_start_date, request_end_date]);

    await recordAuditLog(
      req,
      'LOAN_REQUEST_SUBMITTED',
      'TRANSACTION',
      result.lastID,
      `User ${req.user.name} submitted borrowing request for ${equipment.name} (${equipment.asset_tag})`
    );

    res.status(201).json({
      message: 'Reservation request submitted successfully. A custodian will review it shortly.',
      transactionId: result.lastID
    });
  } catch (err) {
    console.error('Error submitting loan request:', err);
    res.status(500).json({ error: 'Failed to submit loan request' });
  }
});

// GET /api/borrow/my-loans - Borrower's personal loan history & due dates
router.get('/my-loans', authenticateToken, async (req, res) => {
  try {
    await checkOverdueItems();

    const loans = await query.all(`
      SELECT t.*, e.name as equipment_name, e.asset_tag, e.category as equipment_category, e.image_url, e.location
      FROM transactions t
      JOIN equipment e ON t.equipment_id = e.id
      WHERE t.borrower_id = ?
      ORDER BY t.id DESC
    `, [req.user.id]);

    for (const loan of loans) {
      loan.photos = await query.all(
        'SELECT * FROM transaction_photos WHERE transaction_id = ? ORDER BY id ASC',
        [loan.id]
      );
    }

    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve user loans' });
  }
});

// GET /api/borrow/pending - Custodians & Admins review pending requests
router.get('/pending', authenticateToken, authorizeRoles('CUSTODIAN', 'ADMIN'), async (req, res) => {
  try {
    const pending = await query.all(`
      SELECT t.*, 
             e.name as equipment_name, e.asset_tag, e.category as equipment_category, e.status as equipment_status,
             u.name as borrower_name, u.email as borrower_email, u.student_or_staff_id as borrower_code, u.phone as borrower_phone, u.department as borrower_department
      FROM transactions t
      JOIN equipment e ON t.equipment_id = e.id
      JOIN users u ON t.borrower_id = u.id
      WHERE t.status = 'PENDING'
      ORDER BY t.created_at ASC
    `);

    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve pending requests' });
  }
});

// POST /api/borrow/:id/approve - Custodian / Admin approves a request
router.post('/:id/approve', authenticateToken, authorizeRoles('CUSTODIAN', 'ADMIN'), async (req, res) => {
  try {
    const tx = await query.get('SELECT t.*, e.name as eq_name, u.name as borrower_name FROM transactions t JOIN equipment e ON t.equipment_id = e.id JOIN users u ON t.borrower_id = u.id WHERE t.id = ?', [req.params.id]);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction request not found' });
    }

    if (tx.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot approve request with status '${tx.status}'` });
    }

    await query.run(`
      UPDATE transactions 
      SET status = 'APPROVED', custodian_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.user.id, req.params.id]);

    await recordAuditLog(
      req,
      'LOAN_REQUEST_APPROVED',
      'TRANSACTION',
      req.params.id,
      `Custodian ${req.user.name} approved loan request #${req.params.id} for ${tx.borrower_name} (${tx.eq_name})`
    );

    res.json({ message: 'Request approved. Equipment is ready for check-out inspection.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// POST /api/borrow/:id/reject - Custodian / Admin rejects a request
router.post('/:id/reject', authenticateToken, authorizeRoles('CUSTODIAN', 'ADMIN'), async (req, res) => {
  try {
    const { reason } = req.body;
    const tx = await query.get('SELECT t.*, e.name as eq_name, u.name as borrower_name FROM transactions t JOIN equipment e ON t.equipment_id = e.id JOIN users u ON t.borrower_id = u.id WHERE t.id = ?', [req.params.id]);

    if (!tx) {
      return res.status(404).json({ error: 'Transaction request not found' });
    }

    await query.run(`
      UPDATE transactions 
      SET status = 'REJECTED', return_condition_notes = ?, custodian_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [reason ? `Rejection reason: ${reason}` : 'Request rejected by custodian', req.user.id, req.params.id]);

    await recordAuditLog(
      req,
      'LOAN_REQUEST_REJECTED',
      'TRANSACTION',
      req.params.id,
      `Custodian ${req.user.name} rejected loan request #${req.params.id} for ${tx.borrower_name}. Reason: ${reason || 'None specified'}`
    );

    res.json({ message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// GET /api/borrow/active - All active checkouts and overdue items
router.get('/active', authenticateToken, authorizeRoles('CUSTODIAN', 'ADMIN'), async (req, res) => {
  try {
    await checkOverdueItems();

    const activeLoans = await query.all(`
      SELECT t.*, 
             e.name as equipment_name, e.asset_tag, e.category as equipment_category, e.location,
             u.name as borrower_name, u.email as borrower_email, u.student_or_staff_id as borrower_code, u.phone as borrower_phone
      FROM transactions t
      JOIN equipment e ON t.equipment_id = e.id
      JOIN users u ON t.borrower_id = u.id
      WHERE t.status IN ('CHECKED_OUT', 'OVERDUE', 'APPROVED')
      ORDER BY t.request_end_date ASC
    `);

    for (const loan of activeLoans) {
      loan.photos = await query.all(
        'SELECT * FROM transaction_photos WHERE transaction_id = ? ORDER BY id ASC',
        [loan.id]
      );
    }

    res.json(activeLoans);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve active loans' });
  }
});

export default router;
