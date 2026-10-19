const express = require('express');
const path = require('path');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { requestContextMiddleware } = require('./utils/requestContext');

const app = express();

// X-Forwarded-For is trusted only from a reverse proxy on the same machine or private network.
app.set('trust proxy', 'loopback, linklocal, uniquelocal');
app.use(requestContextMiddleware);
app.use(cors());
app.use(
  express.json({
    limit: '2mb',
    // Razorpay webhook signature is computed over the exact raw body
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Static media — same as compameet-backend (/public/user/...)
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// [PHOTO-DEBUG] log every photo upload request as soon as it reaches Express
app.use('/api', (req, res, next) => {
  if (!req.path.includes('/profile/photos')) return next();
  const started = Date.now();
  console.log('[PHOTO-DEBUG] incoming', {
    method: req.method,
    path: req.originalUrl,
    contentType: req.headers['content-type'],
    contentLengthKB: req.headers['content-length']
      ? Math.round(Number(req.headers['content-length']) / 1024)
      : null,
    hasAuth: Boolean(req.headers.authorization),
    ip: req.headers['x-forwarded-for'] || req.ip,
  });
  res.on('finish', () => {
    console.log('[PHOTO-DEBUG] response', {
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - started,
    });
  });
  next();
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
