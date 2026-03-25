const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(uploadsDir));

initializeDatabase();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/policies', require('./routes/policies'));
app.use('/api/assisted', require('./routes/assisted'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/attachments', require('./routes/attachments'));

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato' });
});

// --- Production: serve the frontend build ---
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  // SPA fallback: any non-API GET returns index.html so client-side
  // routing works on direct URL access / page refresh.
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Errore interno del server' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Fimass Sportello Amico API running on port ${PORT} [${isProduction ? 'production' : 'development'}]`);
  if (fs.existsSync(frontendDist)) {
    console.log(`Serving frontend from ${frontendDist}`);
  }
});
