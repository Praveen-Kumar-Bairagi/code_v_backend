const captureService = require('../services/v1/admin/captureService');

const DEFAULT_DAYS = Number(process.env.CAPTURE_RETENTION_DAYS) || 30;
const INTERVAL_MS = Number(process.env.CAPTURE_RETENTION_INTERVAL_MS) || 60 * 60 * 1000;

function startCaptureRetentionJob() {
  const run = async () => {
    try {
      const result = await captureService.purgeOlderThanDays(DEFAULT_DAYS);
      if (result.deleted) {
        console.log(`[capture-retention] purged ${result.deleted} screenshots older than ${DEFAULT_DAYS}d`);
      }
    } catch (err) {
      console.error('[capture-retention]', err.message || err);
    }
  };
  run();
  setInterval(run, INTERVAL_MS);
}

module.exports = { startCaptureRetentionJob };
