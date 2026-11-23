import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDb, UPLOADS_DIR } from './db.js';
import { seedDatabase } from './seed.js';

import authRoutes from './routes/auth.js';
import equipmentRoutes from './routes/equipment.js';
import borrowRoutes from './routes/borrow.js';
import checkRoutes from './routes/check.js';
import auditRoutes from './routes/audit.js';
import usersRoutes from './routes/users.js';
import systemRoutes, { checkOverdueItems } from './routes/system.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static uploads serving
app.use('/uploads', express.static(UPLOADS_DIR));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/borrow', borrowRoutes);
app.use('/api/check', checkRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/system', systemRoutes);

// Root healthcheck
app.get('/api/ping', (req, res) => {
  res.json({ status: 'EquipTrack Backend API is alive', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'An unexpected server error occurred' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDb();
    await seedDatabase();

    // Start background overdue check daemon (runs every 5 minutes)
    setInterval(async () => {
      try {
        const flagged = await checkOverdueItems();
        if (flagged.length > 0) {
          console.log(`[Overdue Daemon] Flagged ${flagged.length} overdue loan(s). Direct email reminders dispatched.`);
        }
      } catch (err) {
        console.error('[Overdue Daemon Error]:', err.message);
      }
    }, 5 * 60 * 1000);

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(` EquipTrack Server is active on http://localhost:${PORT}`);
      console.log(` REST API endpoints available at http://localhost:${PORT}/api`);
      console.log(` Uploads directory mounted at http://localhost:${PORT}/uploads`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
