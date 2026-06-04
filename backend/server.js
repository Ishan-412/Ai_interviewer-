const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');
const config = require('./config/env');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

// Create Express app
const app = express();
const server = http.createServer(app);

// Trust proxy for Render/Heroku load balancers
app.set('trust proxy', 1);

// Socket.io setup
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Middleware ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for frontend
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting on API routes
app.use('/api', apiLimiter);

// ─── Static Files ───────────────────────────────
// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Serve uploaded files (for admin/recruiter viewing)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── API Routes ─────────────────────────────────
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/candidates', require('./routes/candidateRoutes'));
app.use('/api/recruiters', require('./routes/recruiterRoutes'));
app.use('/api/resumes', require('./routes/resumeRoutes'));
app.use('/api/tests', require('./routes/testRoutes'));
app.use('/api/questions', require('./routes/questionRoutes'));
app.use('/api/coding', require('./routes/codingRoutes'));
app.use('/api/interviews', require('./routes/interviewRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// ─── Health Check ───────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'AI Interview Platform API is running.',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ─── Frontend Routes (SPA fallback) ─────────────
// Serve specific HTML pages
const pages = [
  'login', 'register', 'forgot-password',
  'candidate-dashboard', 'recruiter-dashboard', 'admin-dashboard',
  'resume-analysis', 'aptitude-test', 'coding-challenge',
  'mock-interview', 'leaderboard', 'reports', 'profile', 'settings'
];

pages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'pages', `${page}.html`));
  });
});

// Root serves landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'pages', 'index.html'));
});

// ─── Socket.io Events ───────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('join-room', (userId) => {
    socket.join(`user-${userId}`);
  });

  socket.on('notification', (data) => {
    io.to(`user-${data.userId}`).emit('notification', data);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// ─── Error Handling ─────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ───────────────────────────────
const PORT = config.port || 3000;

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║    🚀 AI Interview Platform Server           ║
║    Running on http://localhost:${PORT}          ║
║    Environment: ${process.env.NODE_ENV || 'development'}              ║
╚══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down...');
  server.close(() => process.exit(0));
});

module.exports = { app, server, io };
