const { Op, fn, col } = require('sequelize');
const { SmsLog } = require('../../../models');

const IST_OFFSET = '+05:30';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `from` / `to` are YYYY-MM-DD in IST, both inclusive. */
function dateRange(from, to) {
  const range = {};
  if (DATE_RE.test(String(from || ''))) range[Op.gte] = new Date(`${from}T00:00:00.000${IST_OFFSET}`);
  if (DATE_RE.test(String(to || ''))) range[Op.lte] = new Date(`${to}T23:59:59.999${IST_OFFSET}`);
  return Object.getOwnPropertySymbols(range).length ? range : null;
}

async function listLogs({ page, limit, status, kind, purpose, from, to, search } = {}) {
  const size = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const current = Math.max(parseInt(page, 10) || 1, 1);

  const base = {};
  const created = dateRange(from, to);
  if (created) base.createdAt = created;
  if (kind && kind !== 'all') base.kind = kind;
  if (purpose && purpose !== 'all') base.purpose = purpose;
  const digits = String(search || '').replace(/\D/g, '');
  if (digits) base.mobile = { [Op.like]: `%${digits}%` };

  const where = { ...base };
  if (status && status !== 'all') where.status = status;

  const [{ rows, count }, grouped] = await Promise.all([
    SmsLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: size,
      offset: (current - 1) * size,
      attributes: { exclude: ['response'] },
    }),
    SmsLog.findAll({
      where: base,
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    }),
  ]);

  const summary = { total: 0, sent: 0, failed: 0 };
  grouped.forEach((g) => {
    const n = Number(g.count) || 0;
    summary.total += n;
    if (g.status in summary) summary[g.status] += n;
  });

  return {
    items: rows.map((r) => r.toJSON()),
    summary,
    pagination: { page: current, limit: size, total: count, totalPages: Math.max(1, Math.ceil(count / size)) },
  };
}

/** Full row including the raw gateway response. */
async function getLog(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const row = await SmsLog.findByPk(id);
  return row ? row.toJSON() : null;
}

module.exports = { listLogs, getLog };
