import express from 'express';
import QRCode from 'qrcode';
import { query } from '../db.js';
import { authenticateToken, authorizeRoles, recordAuditLog } from '../middleware/auth.js';

const router = express.Router();

// GET /api/equipment - All users can view catalog
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, status, search, includeArchived } = req.query;
    let sql = 'SELECT * FROM equipment WHERE 1=1';
    const params = [];

    if (!includeArchived || includeArchived === 'false') {
      sql += " AND status != 'ARCHIVED'";
    }

    if (category && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (status && status !== 'All') {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      const s = `%${search.trim()}%`;
      sql += ' AND (name LIKE ? OR asset_tag LIKE ? OR model LIKE ? OR serial_number LIKE ? OR location LIKE ?)';
      params.push(s, s, s, s, s);
    }

    sql += ' ORDER BY id DESC';
    const items = await query.all(sql, params);

    // Map active overdue transactions to equipment
    const overdueTransactions = await query.all(`
      SELECT t.equipment_id, t.status, t.request_end_date, u.name as borrower_name
      FROM transactions t
      JOIN users u ON t.borrower_id = u.id
      WHERE t.status = 'OVERDUE' OR (t.status = 'CHECKED_OUT' AND t.request_end_date < datetime('now'))
    `);

    const overdueMap = {};
    overdueTransactions.forEach((t) => {
      overdueMap[t.equipment_id] = t;
    });

    items.forEach((item) => {
      if (overdueMap[item.id]) {
        item.is_overdue = 1;
        item.overdue_borrower = overdueMap[item.id].borrower_name;
        item.overdue_deadline = overdueMap[item.id].request_end_date;
      } else {
        item.is_overdue = 0;
      }
    });

    // Get live status metrics
    const stats = await query.all(`
      SELECT status, COUNT(*) as count 
      FROM equipment 
      GROUP BY status
    `);

    const summary = {
      total: 0,
      AVAILABLE: 0,
      BORROWED: 0,
      UNDER_REPAIR: 0,
      ARCHIVED: 0
    };

    stats.forEach((s) => {
      summary[s.status] = s.count;
      if (s.status !== 'ARCHIVED') {
        summary.total += s.count;
      }
    });

    res.json({ items, summary });
  } catch (err) {
    console.error('Error fetching equipment:', err);
    res.status(500).json({ error: 'Failed to retrieve equipment list' });
  }
});

// GET /api/equipment/categories - Distinct categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await query.all("SELECT DISTINCT category FROM equipment WHERE status != 'ARCHIVED' ORDER BY category ASC");
    res.json(categories.map((c) => c.category));
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
});

// GET /api/equipment/export/csv - Export equipment catalog report
router.get('/export/csv', authenticateToken, authorizeRoles('ADMIN', 'CUSTODIAN'), async (req, res) => {
  try {
    const items = await query.all('SELECT * FROM equipment ORDER BY id ASC');
    
    // Build CSV
    const headers = ['ID', 'Asset Tag', 'Name', 'Category', 'Model', 'Serial Number', 'Status', 'Location', 'Condition Notes', 'Created At'];
    const rows = items.map(item => [
      item.id,
      `"${item.asset_tag || ''}"`,
      `"${(item.name || '').replace(/"/g, '""')}"`,
      `"${item.category || ''}"`,
      `"${(item.model || '').replace(/"/g, '""')}"`,
      `"${(item.serial_number || '').replace(/"/g, '""')}"`,
      item.status,
      `"${(item.location || '').replace(/"/g, '""')}"`,
      `"${(item.condition_notes || '').replace(/"/g, '""')}"`,
      item.created_at
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="equiptrack_inventory_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('CSV export failed:', err);
    res.status(500).json({ error: 'Failed to export inventory CSV' });
  }
});

// GET /api/equipment/tag/:assetTag - Lookup item by QR asset tag or barcode
router.get('/tag/:assetTag', authenticateToken, async (req, res) => {
  try {
    const tag = req.params.assetTag.trim().toUpperCase();
    const item = await query.get('SELECT * FROM equipment WHERE asset_tag = ?', [tag]);
    if (!item) {
      return res.status(404).json({ error: `Equipment with tag '${tag}' was not found in the database.` });
    }

    // Lookup active transaction if checked out or overdue
    const activeTransaction = await query.get(`
      SELECT t.*, u.name as borrower_name, u.email as borrower_email, u.student_or_staff_id as borrower_code, u.phone as borrower_phone
      FROM transactions t
      JOIN users u ON t.borrower_id = u.id
      WHERE t.equipment_id = ? AND t.status IN ('CHECKED_OUT', 'OVERDUE')
      ORDER BY t.id DESC LIMIT 1
    `, [item.id]);

    let lastPhotos = [];
    if (activeTransaction) {
      lastPhotos = await query.all(
        'SELECT * FROM transaction_photos WHERE transaction_id = ? ORDER BY id ASC',
        [activeTransaction.id]
      );
    }

    res.json({ item, activeTransaction, lastPhotos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to lookup asset tag' });
  }
});

// GET /api/equipment/:id - Single item details & loan history
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const item = await query.get('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const history = await query.all(`
      SELECT t.*, u.name as borrower_name, c.name as custodian_name
      FROM transactions t
      JOIN users u ON t.borrower_id = u.id
      LEFT JOIN users c ON t.custodian_id = c.id
      WHERE t.equipment_id = ?
      ORDER BY t.id DESC LIMIT 15
    `, [item.id]);

    res.json({ item, history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve equipment details' });
  }
});

// POST /api/equipment - Create item & generate QR code (Admin only)
router.post('/', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { name, category, model, serial_number, condition_notes, location, image_url, custom_tag, status } = req.body;

    if (!name || !name.trim() || !category || !category.trim()) {
      return res.status(400).json({ error: 'Equipment Name and Category are required' });
    }

    let assetTag = custom_tag?.trim().toUpperCase();
    if (!assetTag) {
      const prefix = category.substring(0, 3).toUpperCase();
      const countRow = await query.get('SELECT COUNT(*) as count FROM equipment');
      const nextNum = (countRow.count + 1).toString().padStart(3, '0');
      assetTag = `EQP-${prefix}-${nextNum}`;
    }

    const existing = await query.get('SELECT id FROM equipment WHERE asset_tag = ?', [assetTag]);
    if (existing) {
      return res.status(400).json({ error: `Asset tag '${assetTag}' already exists. Please choose a unique tag.` });
    }

    const qrPayload = JSON.stringify({
      asset_tag: assetTag,
      name: name.trim(),
      serial: serial_number || ''
    });
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload);

    const initialStatus = status && ['AVAILABLE', 'BORROWED', 'UNDER_REPAIR', 'ARCHIVED'].includes(status)
      ? status
      : 'AVAILABLE';

    const result = await query.run(`
      INSERT INTO equipment (asset_tag, name, category, model, serial_number, status, condition_notes, location, qr_data, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      assetTag,
      name.trim(),
      category.trim(),
      model?.trim() || '',
      serial_number?.trim() || '',
      initialStatus,
      condition_notes?.trim() || 'Pristine operational condition',
      location?.trim() || 'Central IT Depot',
      qrCodeDataUrl,
      image_url?.trim() || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80'
    ]);

    await recordAuditLog(
      req,
      'CREATE_EQUIPMENT',
      'EQUIPMENT',
      result.lastID,
      `Admin created new asset ${assetTag} ("${name.trim()}") in category "${category.trim()}" with initial status ${initialStatus}`
    );

    const newItem = await query.get('SELECT * FROM equipment WHERE id = ?', [result.lastID]);
    res.status(201).json(newItem);
  } catch (err) {
    console.error('Error creating equipment:', err);
    res.status(500).json({ error: 'Failed to create equipment item' });
  }
});

// PUT /api/equipment/:id - Update item (Admin only)
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { name, category, model, serial_number, status, condition_notes, location, image_url } = req.body;
    const existing = await query.get('SELECT * FROM equipment WHERE id = ?', [req.params.id]);

    if (!existing) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Safety check: Cannot manually change status to AVAILABLE if active unreturned loan exists
    if (status === 'AVAILABLE' && existing.status === 'BORROWED') {
      const activeLoan = await query.get(
        "SELECT id FROM transactions WHERE equipment_id = ? AND status IN ('CHECKED_OUT', 'OVERDUE')",
        [existing.id]
      );
      if (activeLoan) {
        return res.status(400).json({
          error: 'Cannot mark equipment as AVAILABLE while an active loan is checked out. Please process return through the Custodian Check-In desk.'
        });
      }
    }

    // Regenerate QR data with updated metadata
    const qrPayload = JSON.stringify({
      asset_tag: existing.asset_tag,
      name: name?.trim() || existing.name,
      serial: serial_number !== undefined ? serial_number.trim() : existing.serial_number
    });
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload);

    await query.run(`
      UPDATE equipment
      SET name = ?, category = ?, model = ?, serial_number = ?, status = ?, condition_notes = ?, location = ?, image_url = ?, qr_data = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name?.trim() || existing.name,
      category?.trim() || existing.category,
      model !== undefined ? model.trim() : existing.model,
      serial_number !== undefined ? serial_number.trim() : existing.serial_number,
      status || existing.status,
      condition_notes !== undefined ? condition_notes.trim() : existing.condition_notes,
      location !== undefined ? location.trim() : existing.location,
      image_url !== undefined ? image_url.trim() : existing.image_url,
      qrCodeDataUrl,
      req.params.id
    ]);

    await recordAuditLog(
      req,
      'UPDATE_EQUIPMENT',
      'EQUIPMENT',
      req.params.id,
      `Updated asset ${existing.asset_tag} ("${name || existing.name}"). Status: ${status || existing.status}, Category: ${category || existing.category}`
    );

    const updated = await query.get('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('Error updating equipment:', err);
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

// POST /api/equipment/:id/archive - Soft delete / archive item (Admin only)
router.post('/:id/archive', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const existing = await query.get('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    if (existing.status === 'BORROWED') {
      return res.status(400).json({ error: 'Cannot archive equipment while it is actively checked out to a borrower. Please check in the equipment first.' });
    }

    await query.run("UPDATE equipment SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);

    await recordAuditLog(
      req,
      'ARCHIVE_EQUIPMENT',
      'EQUIPMENT',
      req.params.id,
      `Archived asset ${existing.asset_tag} (${existing.name})`
    );

    res.json({ message: `Asset ${existing.asset_tag} archived successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to archive equipment' });
  }
});

// POST /api/equipment/:id/restore - Restore an archived item back to AVAILABLE (Admin only)
router.post('/:id/restore', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const existing = await query.get('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    await query.run("UPDATE equipment SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);

    await recordAuditLog(
      req,
      'RESTORE_EQUIPMENT',
      'EQUIPMENT',
      req.params.id,
      `Restored archived asset ${existing.asset_tag} (${existing.name}) to AVAILABLE`
    );

    res.json({ message: `Asset ${existing.asset_tag} restored to AVAILABLE status.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore equipment' });
  }
});

// DELETE /api/equipment/:id - Permanent hard delete (Admin only)
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const existing = await query.get('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Safety defense: Cannot delete if actively borrowed
    if (existing.status === 'BORROWED') {
      return res.status(400).json({
        error: `Cannot delete asset ${existing.asset_tag} while it is currently BORROWED by a borrower. Please have the custodian check it in first.`
      });
    }

    // Clean up related photos & transactions safely
    await query.run(`
      DELETE FROM transaction_photos 
      WHERE transaction_id IN (SELECT id FROM transactions WHERE equipment_id = ?)
    `, [req.params.id]);

    await query.run('DELETE FROM transactions WHERE equipment_id = ?', [req.params.id]);
    await query.run('DELETE FROM equipment WHERE id = ?', [req.params.id]);

    await recordAuditLog(
      req,
      'PERMANENT_DELETE_EQUIPMENT',
      'EQUIPMENT',
      req.params.id,
      `Permanently deleted asset ${existing.asset_tag} ("${existing.name}", Serial: ${existing.serial_number || 'N/A'}) and associated transaction logs.`
    );

    res.json({ message: `Asset ${existing.asset_tag} permanently deleted from database.` });
  } catch (err) {
    console.error('Error permanently deleting equipment:', err);
    res.status(500).json({ error: 'Failed to permanently delete equipment' });
  }
});

export default router;
