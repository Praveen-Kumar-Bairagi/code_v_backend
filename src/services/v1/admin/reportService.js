'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize, UserReport } = require('../../../models');
const AppError = require('../../../utils/AppError');
const { REPORT_REASONS } = require('../user/reportService');
const adminService = require('./adminService');

const STATUSES = ['pending', 'reviewed', 'action_taken', 'dismissed'];
const SOURCES = ['profile', 'chat'];

function select(sql, replacements) {
  return sequelize.query(sql, { type: QueryTypes.SELECT, replacements });
}

const BASE = `
  FROM user_reports r
  JOIN users rp ON rp.id = r."reporterId"
  JOIN users ru ON ru.id = r."reportedUserId"`;

const COLUMNS = `r.id, r.source, r.reason, r.details, r.status, r."adminNote", r."reviewedAt", r."createdAt",
  r."conversationId", (r."conversationId" IS NOT NULL AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = r."conversationId")) AS "chatExists",
  rp.id AS "reporterId", rp."firstName" AS "reporterFirstName", rp."lastName" AS "reporterLastName",
  ru.id AS "reportedUserId", ru."firstName" AS "reportedFirstName", ru."lastName" AS "reportedLastName",
  ru.photos AS "reportedPhotos", ru."accountStatus" AS "reportedAccountStatus",
  (SELECT count(*)::int FROM user_reports x WHERE x."reportedUserId" = r."reportedUserId") AS "reportsAgainst"`;

/**
 * IT Rules 2021 (as amended): intimate-image and impersonation complaints must be acted on within
 * 2 hours; other complaints acknowledged within 24 hours and resolved within 7 days.
 */
const URGENT_REASONS = ['intimate_images', 'impersonation'];
const HOUR_MS = 60 * 60 * 1000;

function deadlineFor(row) {
  const urgent = URGENT_REASONS.includes(row.reason);
  const dueAt = new Date(new Date(row.createdAt).getTime() + (urgent ? 2 : 7 * 24) * HOUR_MS);
  return { urgent, dueAt, overdue: row.status === 'pending' && dueAt.getTime() < Date.now() };
}

function shape(row) {
  const { reportedPhotos, ...rest } = row;
  return {
    ...rest,
    ...deadlineFor(row),
    reasonLabel: REPORT_REASONS[row.reason] || row.reason,
    reportedPhotoUrl: Array.isArray(reportedPhotos) ? reportedPhotos.find(Boolean) || null : null,
  };
}

async function listReports({ source, status = 'pending', reason, search, page = 1, limit = 25 } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const conds = ['TRUE'];
  const replacements = { limit: size, offset: (pageNum - 1) * size };

  if (SOURCES.includes(source)) {
    conds.push('r.source = :source');
    replacements.source = source;
  }
  if (STATUSES.includes(status)) {
    conds.push('r.status = :status');
    replacements.status = status;
  }
  if (REPORT_REASONS[reason]) {
    conds.push('r.reason = :reason');
    replacements.reason = reason;
  }
  const q = String(search || '').trim();
  if (q) {
    conds.push(`(rp."firstName" || ' ' || coalesce(rp."lastName", '') ILIKE :q
      OR ru."firstName" || ' ' || coalesce(ru."lastName", '') ILIKE :q OR r.details ILIKE :q)`);
    replacements.q = `%${q}%`;
  }
  const where = conds.join(' AND ');
  const sourceOnly = SOURCES.includes(source) ? 'WHERE source = :source' : '';

  const [rows, [summary]] = await Promise.all([
    select(
      `SELECT ${COLUMNS}, count(*) OVER()::int AS "_total" ${BASE}
       WHERE ${where}
       ORDER BY (r.status = 'pending' AND r.reason IN ('intimate_images', 'impersonation')) DESC, r."createdAt" DESC
       LIMIT :limit OFFSET :offset`,
      replacements
    ),
    select(
      `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE status = 'pending')::int AS pending,
          count(*) FILTER (WHERE status = 'reviewed')::int AS reviewed,
          count(*) FILTER (WHERE status = 'action_taken')::int AS "actionTaken",
          count(*) FILTER (WHERE status = 'dismissed')::int AS dismissed
        FROM user_reports ${sourceOnly}`,
      replacements
    ),
  ]);

  const total = rows[0]?._total || 0;
  return {
    items: rows.map(({ _total, ...r }) => shape(r)),
    summary,
    reasons: Object.entries(REPORT_REASONS).map(([id, label]) => ({ id, label })),
    pagination: { page: pageNum, limit: size, total, pages: Math.max(1, Math.ceil(total / size)) },
  };
}

async function getReport(id) {
  const [row] = await select(`SELECT ${COLUMNS}, r.evidence ${BASE} WHERE r.id = :id`, { id });
  if (!row) throw new AppError('Report not found', 404);
  return shape(row);
}

async function updateReport(id, { status, adminNote, action } = {}) {
  const report = await UserReport.findByPk(id);
  if (!report) throw new AppError('Report not found', 404);

  const patch = {};
  if (action === 'suspend') {
    await adminService.updateUserStatus(report.reportedUserId, { status: 'suspended' });
    patch.status = 'action_taken';
  } else if (status !== undefined) {
    if (!STATUSES.includes(status)) throw new AppError('Invalid status', 400);
    patch.status = status;
  }
  if (adminNote !== undefined) patch.adminNote = String(adminNote || '').trim().slice(0, 2000) || null;
  if (patch.status) patch.reviewedAt = patch.status === 'pending' ? null : new Date();

  await report.update(patch);
  return getReport(id);
}

async function pendingCounts() {
  const [row] = await select(
    `SELECT count(*) FILTER (WHERE source = 'profile')::int AS profile,
        count(*) FILTER (WHERE source = 'chat')::int AS chat
      FROM user_reports WHERE status = 'pending'`
  );
  return row;
}

module.exports = { listReports, getReport, updateReport, pendingCounts };
