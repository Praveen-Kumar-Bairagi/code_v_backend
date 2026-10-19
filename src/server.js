require('dotenv').config();

const http = require('http');
const app = require('./app');
const env = require('./config/env');
const db = require('./models');
const { initSocket } = require('./socket');
const { startBookingDeadlineJob } = require('./jobs/bookingDeadlines');
const { startCreatorExpiryJob } = require('./jobs/creatorExpiry');
const { startLegalComplianceJob } = require('./jobs/legalCompliance');
const { startCaptureRetentionJob } = require('./jobs/captureRetention');
const chatModerationService = require('./services/chatModerationService');

const port = env.port;

async function start() {
  try {
    await db.sequelize.authenticate();
    console.log('Database connection established.');
  } catch (err) {
    console.error('Unable to connect to the database:', err.message);
    process.exit(1);
  }

  await chatModerationService.loadConfig({ force: true });

  const server = http.createServer(app);
  initSocket(server);
  if (env.features.bookings) startBookingDeadlineJob({ intervalMs: 30_000 });
  startCreatorExpiryJob();
  startLegalComplianceJob();
  startCaptureRetentionJob();

  server.listen(port, () => {
    console.log(`Compameet API listening on port ${port}`);
  });
}

start();
