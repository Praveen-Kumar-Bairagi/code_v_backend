'use strict';

/**
 * Offset paging over an already ranked list. Without `limit` the full array is returned
 * so older app builds keep working.
 */
function paginateList(list, { limit, offset } = {}, { defaultLimit = 20, maxLimit = 50 } = {}) {
  if (limit == null || limit === '') return list;
  const n = parseInt(limit, 10);
  const size = Number.isFinite(n) && n > 0 ? Math.min(n, maxLimit) : defaultLimit;
  const skip = Math.max(0, parseInt(offset, 10) || 0);
  const items = list.slice(skip, skip + size);
  const hasMore = skip + size < list.length;
  return { items, hasMore, nextOffset: hasMore ? skip + size : null, total: list.length };
}

module.exports = { paginateList };
