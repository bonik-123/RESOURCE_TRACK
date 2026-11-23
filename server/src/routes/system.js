import express from 'express';
import fs from 'fs';
import path from 'path';
import { query, DB_PATH, BACKUPS_DIR } from '../db.js';
import { authenticateToken, authorizeRoles, recordAuditLog } from '../middleware/auth.js';

const router = express.Router();

// Helper to run the overdue check
export async function checkOverdueItems() {
  const now = new Date().toISOString();
  // Find loans that are CHECKED_OUT and past request_end_date
  const overdueLoans = await query.all(`
    SELECT t.*, e.name as equipment_name, e.asset_tag, u.name as borrower_name, u.email as borrower_email
    FROM transactions t
    JOIN equipment e ON t.equipment_id = e.id
    JOIN users u ON t.borrower_id = u.id
    WHERE t.status = 'CHECKED_OUT' AND t.request_end_date < ?
  `, [now]);

  const flagged = [];

  for (const loan of overdueLoans) {
    await query.run(`
      UPDATE transactions 
      SET status = 'OVERDUE', overdue_alert_sent = 1, overdue_alert_count = overdue_alert_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [loan.id]);

    // Insert alert notification for borrower
    await query.run(`
      INSERT INTO system_notifications (user_id, title, message, type)
      VALUES (?, 'OVERDUE NOTICE: Equipment Return Past Due', ?, 'WARNING')
    `, [
      loan.borrower_id,
      `Your loan for "${loan.equipment_name}" (${loan.asset_tag}) was due on ${new Date(loan.request_end_date).toLocaleString()}. Please return it immediately to the equipment depot.`
    ]);

    // Record audit log for automated alert
    await query.run(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, ip_address, details)
      VALUES (?, ?, 'SYSTEM_DAEMON', 'OVERDUE_ALERT_DISPATCHED', 'TRANSACTION', ?, '127.0.0.1', ?)
    `, [
      loan.borrower_id,
      loan.borrower_name,
      String(loan.id),
      `Automated email alert triggered to ${loan.borrower_email} for past-due return of ${loan.asset_tag} (${loan.equipment_name})`
    ]);

    flagged.push({
      loanId: loan.id,
      assetTag: loan.asset_tag,
      borrower: loan.borrower_name,
      email: loan.borrower_email,
      dueDate: loan.request_end_date
    });
  }

  return flagged;
}

// GET /api/system/health - Metrics for overview cards
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const totalEquipment = await query.get("SELECT COUNT(*) as count FROM equipment WHERE status != 'ARCHIVED'");
    const availableEquipment = await query.get("SELECT COUNT(*) as count FROM equipment WHERE status = 'AVAILABLE'");
    const borrowedEquipment = await query.get("SELECT COUNT(*) as count FROM equipment WHERE status = 'BORROWED'");
    const underRepairEquipment = await query.get("SELECT COUNT(*) as count FROM equipment WHERE status = 'UNDER_REPAIR'");

    const activeLoans = await query.get("SELECT COUNT(*) as count FROM transactions WHERE status = 'CHECKED_OUT'");
    const overdueLoans = await query.get("SELECT COUNT(*) as count FROM transactions WHERE status = 'OVERDUE'");
    const pendingRequests = await query.get("SELECT COUNT(*) as count FROM transactions WHERE status = 'PENDING'");
    const totalBorrowers = await query.get("SELECT COUNT(*) as count FROM users WHERE role = 'BORROWER'");

    res.json({
      equipment: {
        total: totalEquipment.count,
        available: availableEquipment.count,
        borrowed: borrowedEquipment.count,
        underRepair: underRepairEquipment.count,
      },
      transactions: {
        active: activeLoans.count,
        overdue: overdueLoans.count,
        pending: pendingRequests.count,
      },
      users: {
        totalBorrowers: totalBorrowers.count,
      },
      system: {
        databaseEngine: 'SQLite 3 (ACID Relational Integrity)',
        serverTime: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        status: 'OPERATIONAL'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve system health metrics' });
  }
});

// POST /api/system/trigger-overdue-check - Run overdue cron routine manually
router.post('/trigger-overdue-check', authenticateToken, authorizeRoles('ADMIN', 'CUSTODIAN'), async (req, res) => {
  try {
    const flagged = await checkOverdueItems();
    res.json({
      message: `Overdue routine completed. ${flagged.length} past-due item(s) processed.`,
      flaggedItems: flagged
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to run overdue check' });
  }
});

// POST /api/system/backup - Admin trigger database backup
router.post('/backup', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `equiptrack_backup_${timestamp}.db`;
    const destinationPath = path.join(BACKUPS_DIR, backupFileName);

    fs.copyFileSync(DB_PATH, destinationPath);
    const stats = fs.statSync(destinationPath);

    await recordAuditLog(
      req,
      'DATABASE_BACKUP',
      'SYSTEM',
      backupFileName,
      `Manual database backup completed. File: ${backupFileName} (${(stats.size / 1024).toFixed(1)} KB)`
    );

    res.json({
      message: 'Database backup created successfully.',
      filename: backupFileName,
      sizeBytes: stats.size,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Failed to execute database backup' });
  }
});

// GET /api/system/backups - List all backups
router.get('/backups', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json([]);
    }

    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.db'));
    const backups = files.map((fileName) => {
      const filePath = path.join(BACKUPS_DIR, fileName);
      const stat = fs.statSync(filePath);
      return {
        filename: fileName,
        sizeBytes: stat.size,
        createdAt: stat.birthtime,
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// GET /api/system/backups/:filename - Download backup file
router.get('/backups/:filename', authenticateToken, authorizeRoles('ADMIN'), (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(BACKUPS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    res.download(filePath, filename);
  } catch (err) {
    res.status(500).json({ error: 'Failed to download backup' });
  }
});

export default router;
