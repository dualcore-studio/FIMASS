const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeDatabase } = require('./config/database');
const { bootstrapDatabaseIfEmpty } = require('./seed/bootstrap');

const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = Boolean(process.env.VERCEL);

const uploadsDir = process.env.UPLOADS_DIR || (isVercel ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads'));
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

initializeDatabase();
bootstrapDatabaseIfEmpty().catch((err) => {
  console.error('Bootstrap error:', err);
});

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(uploadsDir));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/quotes', require('./routes/quotes'));
  app.use('/api/policies', require('./routes/policies'));
  app.use('/api/assisted', require('./routes/assisted'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/logs', require('./routes/logs'));
  app.use('/api/settings', require('./routes/settings'));
  app.use('/api/attachments', require('./routes/attachments'));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint non trovato' });
  });

  // --- Production non-Vercel: serve the frontend build ---
  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  if (!isVercel && fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  });

  return app;
}

const app = createApp();

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fimass Sportello Amico API running on port ${PORT} [${isProduction ? 'production' : 'development'}]`);
    console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'set' : 'NOT SET (using auto-generated)'}`);
  });
}

module.exports = app;
