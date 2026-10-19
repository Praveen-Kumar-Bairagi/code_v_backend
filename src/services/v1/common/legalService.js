'use strict';

const { Op } = require('sequelize');
const { LegalDocument } = require('../../../models');
const AppError = require('../../../utils/AppError');

/** Legacy short slugs kept for old links — never show in Legal list. */
const ALIAS_SLUGS = new Set([
  'terms',
  'privacy',
  'cancellation',
  'refund-policy',
  'code-of-conduct',
  'safety',
]);

function formatDoc(doc) {
  const json = doc.toJSON ? doc.toJSON() : doc;
  return {
    id: json.id,
    slug: json.slug,
    title: json.title,
    content: json.content,
    isActive: json.isActive !== false,
    version: json.version ?? 1,
    sortOrder: json.sortOrder ?? 0,
    requiresAcceptance: json.requiresAcceptance !== false,
    audience: json.audience || 'all',
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

async function listLegalDocuments({ includeInactive = false } = {}) {
  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    slug: { [Op.notIn]: [...ALIAS_SLUGS] },
  };
  const rows = await LegalDocument.findAll({
    where,
    order: [
      ['sortOrder', 'ASC'],
      ['title', 'ASC'],
    ],
  });

  // Dedupe by title in case legacy rows share titles with canonical docs.
  const seenTitles = new Set();
  const items = [];
  for (const row of rows) {
    const formatted = formatDoc(row);
    const key = String(formatted.title || '')
      .trim()
      .toLowerCase();
    if (key && seenTitles.has(key)) continue;
    if (key) seenTitles.add(key);
    items.push(formatted);
  }
  return { items };
}

async function getLegalBySlug(slug, { allowInactive = false } = {}) {
  const key = String(slug).trim();
  const doc = await LegalDocument.findOne({ where: { slug: key } });
  if (!doc) throw new AppError('Legal document not found', 404);
  const allowAlias = ALIAS_SLUGS.has(key);
  if (!allowInactive && !allowAlias && doc.isActive === false) {
    throw new AppError('Legal document not found', 404);
  }
  return formatDoc(doc);
}

async function updateLegalBySlug(
  slug,
  { title, content, isActive, requiresAcceptance, audience, sortOrder } = {}
) {
  const doc = await LegalDocument.findOne({ where: { slug: String(slug).trim() } });
  if (!doc) throw new AppError('Legal document not found', 404);

  let bumpVersion = false;

  if (title !== undefined) {
    const trimmed = String(title).trim();
    if (!trimmed) throw new AppError('Title cannot be empty', 400);
    if (trimmed !== doc.title) bumpVersion = true;
    doc.title = trimmed;
  }
  if (content !== undefined) {
    const next = String(content);
    if (next !== doc.content) bumpVersion = true;
    doc.content = next;
  }
  if (isActive !== undefined) doc.isActive = Boolean(isActive);
  if (requiresAcceptance !== undefined) {
    doc.requiresAcceptance = Boolean(requiresAcceptance);
  }
  if (audience !== undefined) {
    const a = String(audience || 'all').trim().toLowerCase();
    if (!['all', 'user', 'companion'].includes(a)) {
      throw new AppError('audience must be all, user, or companion', 400);
    }
    doc.audience = a;
  }
  if (sortOrder !== undefined) {
    const n = Number(sortOrder);
    if (!Number.isFinite(n)) throw new AppError('Invalid sortOrder', 400);
    doc.sortOrder = Math.round(n);
  }
  if (bumpVersion) {
    doc.version = Number(doc.version || 1) + 1;
  }

  await doc.save();
  return formatDoc(doc);
}

module.exports = {
  listLegalDocuments,
  getLegalBySlug,
  updateLegalBySlug,
  ALIAS_SLUGS,
};
