const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/error');
const Role = require('./models/Role');

// Load env vars
dotenv.config();

// Seed roles function
const seedRoles = async () => {
  try {
    const rolesCount = await Role.countDocuments();
    if (rolesCount === 0) {
      const defaultRoles = [
        { name: 'Administrator', description: 'Enterprise system administrator with full read/write privileges across all records.' },
        { name: 'Procurement Officer', description: 'Manages requests, interfaces with suppliers, generates purchase orders, and tracks deliveries.' },
        { name: 'Project Manager', description: 'Approves or rejects site engineering material requests and tracks project budgets.' },
        { name: 'Site Engineer', description: 'Submits material requests, accepts shipments, and logs damaged material reports.' },
        { name: 'Supplier', description: 'Views purchase orders, submits pricing quotes, uploads invoices, and marks shipping statuses.' },
        { name: 'Accountant', description: 'Tracks purchase order costs, posts partial or complete payments, and issues financial statements.' },
        { name: 'Delivery Staff', description: 'Assigned deliveries, updates shipping tracking steps, and logs delivery confirmations.' }
      ];
      await Role.insertMany(defaultRoles);
      console.log('Default enterprise roles seeded successfully.');
    }
  } catch (error) {
    console.error(`Failed to seed roles: ${error.message}`);
  }
};

const app = express();

// Body parser
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Uploaded images (materials + profile avatars)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Cookie parser
app.use(cookieParser());

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Set security headers (allow uploaded images via same-site proxy)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Enable CORS (web + Flutter mobile / local tooling)
const corsOrigins = (
  process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (Flutter mobile) with no Origin header
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Mount routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/users', require('./routes/user'));
app.use('/api/projects', require('./routes/project'));
app.use('/api/categories', require('./routes/category'));
app.use('/api/suppliers', require('./routes/supplier'));
app.use('/api/materials', require('./routes/material'));
app.use('/api/requests', require('./routes/request'));
app.use('/api/notifications', require('./routes/notification'));
app.use('/api/orders', require('./routes/order'));
app.use('/api/quotations', require('./routes/quotation'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/deliveries', require('./routes/delivery'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/reports', require('./routes/report'));
app.use('/api/system', require('./routes/system'));

// Centralized API error handling (before SPA fallback)
app.use(errorHandler);

// Production: optionally serve built React app (monolith). Set SERVE_SPA=false when frontend is on Vercel.
const clientDist = path.join(__dirname, 'public');
const serveSpa =
  process.env.NODE_ENV === 'production' &&
  process.env.SERVE_SPA !== 'false' &&
  fs.existsSync(path.join(clientDist, 'index.html'));

if (serveSpa) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      message: 'BuildFlow API is running',
      status: 'Running',
      version: '1.0.0'
    });
  });
}

const PORT = process.env.PORT || 5000;

let server;

const startServer = async () => {
  await connectDB();
  await seedRoles();
  const { startReportScheduler } = require('./utils/reportScheduler');
  startReportScheduler();
  server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Unhandled Rejection Error: ${err.message}`);
  // Close server & exit process
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});
