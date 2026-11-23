import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, UPLOADS_DIR } from '../db.js';
import { authenticateToken, authorizeRoles, recordAuditLog } from '../middleware/auth.js';

const router = express.Router();

// Multer storage configuration for condition photos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `condition-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per photo
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper to save base64 photo if user took picture via browser canvas/camera
async function saveBase64Image(base64Data, prefix = 'camera') {
  if (!base64Data || !base64Data.startsWith('data:image')) return null;
  const matches = base64Data.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;

  const ext = matches[1].replace('jpeg', 'jpg');
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  fs.writeFileSync(filePath, buffer);
  return `/uploads/${filename}`;
}

// POST /api/check/checkout - Custodian check-out with pre-inspection photos
router.post(
  '/checkout',
  authenticateToken,
  authorizeRoles('CUSTODIAN', 'ADMIN'),
  upload.array('photos', 4),
  async (req, res) => {
    try {
      const { transaction_id, asset_tag, borrower_id, notes, base64Photos } = req.body;

      let tx = null;
      if (transaction_id) {
        tx = await query.get('SELECT * FROM transactions WHERE id = ?', [transaction_id]);
      } else if (asset_tag) {
        // Direct walk-in check-out by scanning equipment tag
        const eq = await query.get('SELECT * FROM equipment WHERE asset_tag = ?', [asset_tag.trim().toUpperCase()]);
        if (!eq) return res.status(404).json({ error: `Equipment with tag ${asset_tag} not found.` });

        if (eq.status !== 'AVAILABLE') {
          return res.status(400).json({ error: `Equipment is currently ${eq.status} and cannot be checked out.` });
        }

        // Look for approved reservation or create on-the-spot checkout
        tx = await query.get(
          "SELECT * FROM transactions WHERE equipment_id = ? AND status = 'APPROVED' ORDER BY id DESC LIMIT 1",
          [eq.id]
        );

        if (!tx) {
          if (!borrower_id) {
            return res.status(400).json({ error: 'Borrower ID is required for on-the-spot check out without reservation' });
          }
          const defaultDue = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
          const newTx = await query.run(`
            INSERT INTO transactions (equipment_id, borrower_id, custodian_id, status, purpose, request_start_date, request_end_date)
            VALUES (?, ?, ?, 'APPROVED', 'Immediate Walk-in Desk Loan', CURRENT_TIMESTAMP, ?)
          `, [eq.id, borrower_id, req.user.id, defaultDue]);

          tx = await query.get('SELECT * FROM transactions WHERE id = ?', [newTx.lastID]);
        }
      }

      if (!tx) {
        return res.status(404).json({ error: 'Valid transaction not found for checkout' });
      }

      // Update transaction
      const now = new Date().toISOString();
      await query.run(`
        UPDATE transactions
        SET status = 'CHECKED_OUT', custodian_id = ?, actual_checkout_date = ?, checkout_condition_notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [req.user.id, now, notes || 'Verified operational before handoff', tx.id]);

      // Update equipment status to BORROWED
      await query.run(`
        UPDATE equipment
        SET status = 'BORROWED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [tx.equipment_id]);

      // Save photos: Multer uploaded files
      const savedPhotos = [];
      if (req.files && req.files.length > 0) {
        for (const f of req.files) {
          const photoUrl = `/uploads/${f.filename}`;
          await query.run(`
            INSERT INTO transaction_photos (transaction_id, photo_type, image_url, caption, uploaded_by)
            VALUES (?, 'CHECK_OUT', ?, ?, ?)
          `, [tx.id, photoUrl, 'Check-out pre-inspection photo', req.user.id]);
          savedPhotos.push(photoUrl);
        }
      }

      // Also process base64 photos if sent from browser camera component
      if (base64Photos) {
        const photosArray = Array.isArray(base64Photos) ? base64Photos : [base64Photos];
        for (const b64 of photosArray) {
          const url = await saveBase64Image(b64, 'checkout-cam');
          if (url) {
            await query.run(`
              INSERT INTO transaction_photos (transaction_id, photo_type, image_url, caption, uploaded_by)
              VALUES (?, 'CHECK_OUT', ?, ?, ?)
            `, [tx.id, url, 'Check-out live camera snapshot', req.user.id]);
            savedPhotos.push(url);
          }
        }
      }

      const eqInfo = await query.get('SELECT asset_tag, name FROM equipment WHERE id = ?', [tx.equipment_id]);
      await recordAuditLog(
        req,
        'CHECK_OUT',
        'TRANSACTION',
        tx.id,
        `Equipment ${eqInfo.asset_tag} (${eqInfo.name}) checked out by custodian ${req.user.name}. ${savedPhotos.length} pre-condition photo(s) recorded.`
      );

      res.json({
        message: 'Equipment check-out completed successfully.',
        transactionId: tx.id,
        photosRecorded: savedPhotos.length
      });
    } catch (err) {
      console.error('Error during checkout:', err);
      res.status(500).json({ error: 'Failed to process equipment check-out' });
    }
  }
);

// POST /api/check/checkin - Custodian check-in with return condition inspection photos & damage logging
router.post(
  '/checkin',
  authenticateToken,
  authorizeRoles('CUSTODIAN', 'ADMIN'),
  upload.array('photos', 4),
  async (req, res) => {
    try {
      const { transaction_id, asset_tag, notes, has_damage, damage_severity, base64Photos } = req.body;

      let tx = null;
      if (transaction_id) {
        tx = await query.get('SELECT * FROM transactions WHERE id = ?', [transaction_id]);
      } else if (asset_tag) {
        const eq = await query.get('SELECT * FROM equipment WHERE asset_tag = ?', [asset_tag.trim().toUpperCase()]);
        if (!eq) return res.status(404).json({ error: `Equipment with tag ${asset_tag} not found.` });

        tx = await query.get(`
          SELECT * FROM transactions 
          WHERE equipment_id = ? AND status IN ('CHECKED_OUT', 'OVERDUE')
          ORDER BY id DESC LIMIT 1
        `, [eq.id]);
      }

      if (!tx) {
        return res.status(404).json({ error: 'No active checked-out loan found for this item.' });
      }

      const isDamaged = has_damage === true || has_damage === 'true' || has_damage === 1;
      const severity = isDamaged ? (damage_severity || 'MINOR') : 'NONE';
      const now = new Date().toISOString();

      // Update transaction
      await query.run(`
        UPDATE transactions
        SET status = 'RETURNED',
            actual_return_date = ?,
            return_condition_notes = ?,
            has_damage = ?,
            damage_severity = ?,
            custodian_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [now, notes || 'Item inspected upon return', isDamaged ? 1 : 0, severity, req.user.id, tx.id]);

      // If damaged, update equipment status to UNDER_REPAIR; else AVAILABLE
      const newEquipmentStatus = isDamaged ? 'UNDER_REPAIR' : 'AVAILABLE';
      const damageNoteAppend = isDamaged ? ` [DAMAGE REPORTED on return: ${notes || 'Condition impaired'}]` : '';

      await query.run(`
        UPDATE equipment
        SET status = ?,
            condition_notes = condition_notes || ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newEquipmentStatus, damageNoteAppend, tx.equipment_id]);

      // Process uploaded photos
      const savedPhotos = [];
      if (req.files && req.files.length > 0) {
        for (const f of req.files) {
          const photoUrl = `/uploads/${f.filename}`;
          await query.run(`
            INSERT INTO transaction_photos (transaction_id, photo_type, image_url, caption, uploaded_by)
            VALUES (?, 'CHECK_IN', ?, ?, ?)
          `, [tx.id, photoUrl, isDamaged ? `Damage Proof (${severity}): Return inspection` : 'Return inspection photo', req.user.id]);
          savedPhotos.push(photoUrl);
        }
      }

      if (base64Photos) {
        const photosArray = Array.isArray(base64Photos) ? base64Photos : [base64Photos];
        for (const b64 of photosArray) {
          const url = await saveBase64Image(b64, 'checkin-cam');
          if (url) {
            await query.run(`
              INSERT INTO transaction_photos (transaction_id, photo_type, image_url, caption, uploaded_by)
              VALUES (?, 'CHECK_IN', ?, ?, ?)
            `, [tx.id, url, isDamaged ? `Damage Proof (${severity}) live capture` : 'Return condition live capture', req.user.id]);
            savedPhotos.push(url);
          }
        }
      }

      const eqInfo = await query.get('SELECT asset_tag, name FROM equipment WHERE id = ?', [tx.equipment_id]);
      const auditAction = isDamaged ? 'CHECK_IN_DAMAGE' : 'CHECK_IN_CLEAN';
      const auditDetail = isDamaged
        ? `Equipment ${eqInfo.asset_tag} (${eqInfo.name}) returned with ${severity} damage. Status shifted to UNDER_REPAIR. Photos recorded: ${savedPhotos.length}. Notes: ${notes || 'N/A'}`
        : `Equipment ${eqInfo.asset_tag} (${eqInfo.name}) safely returned in good condition. Status shifted to AVAILABLE.`;

      await recordAuditLog(req, auditAction, 'TRANSACTION', tx.id, auditDetail);

      res.json({
        message: isDamaged ? 'Equipment returned and flagged as UNDER REPAIR with photo proof.' : 'Equipment checked in successfully and marked AVAILABLE.',
        transactionId: tx.id,
        isDamaged,
        newEquipmentStatus,
        photosRecorded: savedPhotos.length
      });
    } catch (err) {
      console.error('Error during check-in:', err);
      res.status(500).json({ error: 'Failed to process equipment check-in' });
    }
  }
);

// GET /api/check/compare/:transactionId - Pre-and-post inspection comparison evidence
router.get('/compare/:transactionId', authenticateToken, async (req, res) => {
  try {
    const tx = await query.get(`
      SELECT t.*, 
             e.name as equipment_name, e.asset_tag, e.category as equipment_category,
             u.name as borrower_name, u.email as borrower_email, u.student_or_staff_id as borrower_code,
             c.name as custodian_name
      FROM transactions t
      JOIN equipment e ON t.equipment_id = e.id
      JOIN users u ON t.borrower_id = u.id
      LEFT JOIN users c ON t.custodian_id = c.id
      WHERE t.id = ?
    `, [req.params.transactionId]);

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const photos = await query.all(
      'SELECT * FROM transaction_photos WHERE transaction_id = ? ORDER BY uploaded_at ASC',
      [tx.id]
    );

    const checkOutPhotos = photos.filter((p) => p.photo_type === 'CHECK_OUT');
    const checkInPhotos = photos.filter((p) => p.photo_type === 'CHECK_IN');

    res.json({
      transaction: tx,
      checkOutPhotos,
      checkInPhotos
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve comparison data' });
  }
});

export default router;
