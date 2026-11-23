import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

// Ensure required directories exist
[DATA_DIR, UPLOADS_DIR, BACKUPS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const DB_PATH = path.join(DATA_DIR, 'equiptrack.db');

export const dbInstance = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to EquipTrack SQLite database at:', DB_PATH);
  }
});

// Enable foreign keys
dbInstance.run('PRAGMA foreign_keys = ON');

// Promisified DB helpers
export const query = {
  get: (sql, params = []) =>
    new Promise((resolve, reject) => {
      dbInstance.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    }),

  all: (sql, params = []) =>
    new Promise((resolve, reject) => {
      dbInstance.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    }),

  run: (sql, params = []) =>
    new Promise((resolve, reject) => {
      dbInstance.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    }),

  exec: (sql) =>
    new Promise((resolve, reject) => {
      dbInstance.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }),
};

export async function initDb() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('BORROWER', 'CUSTODIAN', 'ADMIN')),
      department TEXT,
      student_or_staff_id TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_tag TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      model TEXT,
      serial_number TEXT,
      status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'BORROWED', 'UNDER_REPAIR', 'ARCHIVED')),
      condition_notes TEXT DEFAULT 'Good condition',
      location TEXT DEFAULT 'Main IT Depot / Lab 204',
      qr_data TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      borrower_id INTEGER NOT NULL REFERENCES users(id),
      custodian_id INTEGER REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CHECKED_OUT', 'RETURNED', 'OVERDUE', 'CANCELLED')),
      purpose TEXT,
      request_start_date DATETIME NOT NULL,
      request_end_date DATETIME NOT NULL,
      actual_checkout_date DATETIME,
      actual_return_date DATETIME,
      checkout_condition_notes TEXT,
      return_condition_notes TEXT,
      has_damage INTEGER DEFAULT 0,
      damage_severity TEXT DEFAULT 'NONE' CHECK(damage_severity IN ('NONE', 'MINOR', 'MODERATE', 'SEVERE')),
      overdue_alert_sent INTEGER DEFAULT 0,
      overdue_alert_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transaction_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      photo_type TEXT NOT NULL CHECK(photo_type IN ('CHECK_OUT', 'CHECK_IN')),
      image_url TEXT NOT NULL,
      caption TEXT,
      uploaded_by INTEGER REFERENCES users(id),
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      user_name TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      ip_address TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'INFO',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await query.exec(schema);
  console.log('EquipTrack database schema initialized successfully.');
}

export { DB_PATH, UPLOADS_DIR, BACKUPS_DIR };
