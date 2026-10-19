'use strict';

/**
 * Chat Moderation Engine — single entry point for every chat message.
 * Combines contact-information protection and abusive-language detection,
 * merges their masks and reports categories + overall severity.
 */

const {
  CATEGORY: CONTACT_SUB,
  DEFAULT_CONFIG: CONTACT_DEFAULTS,
  moderateContactInfo,
} = require('./contactModeration');
const { ABUSE_CATEGORY, SEVERITY, detectAbuse } = require('./abuseModeration');

const MODERATION_CATEGORY = Object.freeze({
  CONTACT: 'contact_info',
  SOCIAL: 'social_media',
  PROFANITY: ABUSE_CATEGORY.PROFANITY,
  INSULT: ABUSE_CATEGORY.INSULT,
  HARASSMENT: ABUSE_CATEGORY.HARASSMENT,
  HATE: ABUSE_CATEGORY.HATE,
  THREAT: ABUSE_CATEGORY.THREAT,
});

const CONTACT_TO_CATEGORY = {
  [CONTACT_SUB.PHONE]: MODERATION_CATEGORY.CONTACT,
  [CONTACT_SUB.EMAIL]: MODERATION_CATEGORY.CONTACT,
  [CONTACT_SUB.PLATFORM]: MODERATION_CATEGORY.SOCIAL,
  [CONTACT_SUB.HANDLE]: MODERATION_CATEGORY.SOCIAL,
  [CONTACT_SUB.LINK]: MODERATION_CATEGORY.SOCIAL,
  [CONTACT_SUB.CUSTOM]: MODERATION_CATEGORY.SOCIAL,
};

/** Admin toggle key for each abuse category. */
const ABUSE_TOGGLES = {
  [ABUSE_CATEGORY.PROFANITY]: 'maskProfanity',
  [ABUSE_CATEGORY.INSULT]: 'maskInsults',
  [ABUSE_CATEGORY.HARASSMENT]: 'maskHarassment',
  [ABUSE_CATEGORY.HATE]: 'maskHateSpeech',
  [ABUSE_CATEGORY.THREAT]: 'maskThreats',
};

const DEFAULT_ENGINE_CONFIG = Object.freeze({
  ...CONTACT_DEFAULTS,
  maskProfanity: true,
  maskInsults: true,
  maskHarassment: true,
  maskHateSpeech: true,
  maskThreats: true,
  customTerms: [],
  allowedWords: [],
});

function cleanList(list, max = 500) {
  return Array.isArray(list)
    ? list.map((w) => String(w ?? '').trim()).filter(Boolean).slice(0, max)
    : [];
}

function normalizeEngineConfig(config) {
  const merged = { ...DEFAULT_ENGINE_CONFIG, ...(config && typeof config === 'object' ? config : {}) };
  for (const key of Object.keys(DEFAULT_ENGINE_CONFIG)) {
    if (typeof DEFAULT_ENGINE_CONFIG[key] === 'boolean') merged[key] = merged[key] !== false;
  }
  merged.extraWords = cleanList(merged.extraWords, 200);
  merged.allowedWords = cleanList(merged.allowedWords);
  merged.customTerms = (Array.isArray(merged.customTerms) ? merged.customTerms : [])
    .map((t) => ({
      word: String(t?.word ?? '').trim(),
      category: Object.values(ABUSE_CATEGORY).includes(t?.category) ? t.category : ABUSE_CATEGORY.PROFANITY,
      severity: [1, 2, 3].includes(Number(t?.severity)) ? Number(t.severity) : SEVERITY.SEVERE,
    }))
    .filter((t) => t.word.length >= 2)
    .slice(0, 500);
  return merged;
}

/**
 * @returns {{ masked: string, flagged: boolean, categories: string[], severity: number,
 *             matchCount: number, educational: boolean,
 *             matches: { category: string, severity: number, start: number, end: number }[] }}
 */
function moderateChatMessage(text, config) {
  const cfg = normalizeEngineConfig(config);
  const original = typeof text === 'string' ? text : String(text ?? '');
  const clean = {
    masked: original,
    flagged: false,
    categories: [],
    severity: 0,
    matchCount: 0,
    educational: false,
    matches: [],
  };
  if (!cfg.enabled || !original.trim()) return clean;

  const matches = [];

  const contact = moderateContactInfo(original, cfg);
  contact.matches.forEach((m) => {
    matches.push({
      category: CONTACT_TO_CATEGORY[m.category] || MODERATION_CATEGORY.SOCIAL,
      severity: SEVERITY.MILD,
      start: m.start,
      end: m.end,
    });
  });

  const categories = {};
  Object.entries(ABUSE_TOGGLES).forEach(([cat, key]) => {
    categories[cat] = cfg[key];
  });
  const abuse = detectAbuse(original, {
    categories,
    customTerms: cfg.customTerms,
    allowedWords: cfg.allowedWords,
  });
  const educational = abuse.some((m) => m.educational);
  abuse.forEach((m) => matches.push({ category: m.category, severity: m.severity, start: m.start, end: m.end }));

  if (!matches.length) return clean;

  const chars = Array.from(original);
  const flags = new Array(chars.length).fill(false);
  matches.forEach((m) => {
    for (let i = m.start; i < m.end && i < chars.length; i += 1) flags[i] = true;
  });
  const masked = chars.map((c, i) => (flags[i] && c !== '\n' && c !== '\r' ? '*' : c)).join('');

  return {
    masked,
    flagged: masked !== original,
    categories: [...new Set(matches.map((m) => m.category))],
    severity: Math.max(...matches.map((m) => m.severity)),
    matchCount: matches.length,
    educational,
    matches,
  };
}

module.exports = {
  MODERATION_CATEGORY,
  SEVERITY,
  DEFAULT_ENGINE_CONFIG,
  ABUSE_TOGGLES,
  moderateChatMessage,
  normalizeEngineConfig,
};
