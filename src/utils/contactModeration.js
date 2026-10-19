'use strict';

/**
 * Contact-information masking for chat messages.
 *
 * Pure and synchronous: given text + config it returns the masked text and the
 * categories that matched. Masking keeps the original length (one `*` per
 * character), so the message keeps its shape and the result is idempotent.
 */

const CATEGORY = {
  PLATFORM: 'social_platform',
  HANDLE: 'social_handle',
  LINK: 'social_link',
  PHONE: 'phone_number',
  EMAIL: 'email',
  CUSTOM: 'custom_word',
};

const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  maskPlatforms: true,
  maskHandles: true,
  maskLinks: true,
  maskPhones: true,
  maskEmails: true,
  extraWords: [],
});

/* ------------------------------------------------------------------ */
/* Character normalisation                                             */
/* ------------------------------------------------------------------ */

const LATIN_MARKS = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g;

const HOMOGLYPHS = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's',
  ԁ: 'd', ɡ: 'g', ո: 'n', ս: 'u', к: 'k', м: 'm', т: 't', в: 'b', н: 'h', ӏ: 'l',
  ԝ: 'w', ѡ: 'w', ɑ: 'a', ı: 'i', һ: 'h', ԛ: 'q', ɩ: 'i', ʏ: 'y', ᴡ: 'w', ᴀ: 'a', ꜱ: 's',
  α: 'a', ε: 'e', ο: 'o', ρ: 'p', τ: 't', υ: 'u', ν: 'v', κ: 'k', ι: 'i', μ: 'm',
  η: 'n', ω: 'w', β: 'b', γ: 'y', χ: 'x', ς: 's', σ: 's',
  ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ł: 'l', ħ: 'h',
};

/** Leetspeak substitutions, only applied when the symbol sits next to a letter. */
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's' };

/** Emoji-style letters (🅰 🄰 🅐 and regional indicators) that NFKD doesn't decompose. */
const LETTER_BLOCKS = [0x1f130, 0x1f150, 0x1f170, 0x1f1e6];

const DIGIT_ZEROS = [
  0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xff10,
];

const INVISIBLE = /^[\p{Cf}\u034f\u115f\u1160\u17b4\u17b5\u3164\uffa0]$/u;
const LETTERISH = /^[\p{L}\p{M}]+$/u;

function digitValue(ch) {
  const cp = ch.codePointAt(0);
  for (const zero of DIGIT_ZEROS) {
    if (cp >= zero && cp <= zero + 9) return cp - zero;
  }
  const n = ch.normalize('NFKC');
  return /^[0-9]$/.test(n) ? Number(n) : null;
}

/**
 * Lower-cased, de-accented, homoglyph-folded form of one code point.
 * opts.unifyIL (default true) folds `l` into `i` (te1egram, signa1).
 */
function foldChar(ch, opts = {}) {
  const cp = ch.codePointAt(0);
  for (const base of LETTER_BLOCKS) {
    if (cp >= base && cp < base + 26) return String.fromCharCode(97 + cp - base);
  }
  const unifyIL = opts.unifyIL !== false;
  let out = '';
  for (const c of ch.normalize('NFKD').replace(LATIN_MARKS, '').toLowerCase()) {
    const mapped = HOMOGLYPHS[c] ?? c;
    out += unifyIL && mapped === 'l' ? 'i' : mapped;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Index helpers                                                       */
/* ------------------------------------------------------------------ */

function toCodePoints(text) {
  const chars = Array.from(text);
  const utf16ToCp = new Array(text.length + 1);
  let u = 0;
  chars.forEach((c, i) => {
    for (let k = 0; k < c.length; k += 1) utf16ToCp[u + k] = i;
    u += c.length;
  });
  utf16ToCp[text.length] = chars.length;
  return { chars, utf16ToCp };
}

/** Classify every code point: invisible, letter (with folded skeleton chars), digit, or separator. */
function classify(chars, opts = {}) {
  const info = chars.map((ch) => {
    if (INVISIBLE.test(ch)) return { kind: 'invisible' };
    if (/\p{Nd}/u.test(ch)) return { kind: 'digit', digit: digitValue(ch) };
    const folded = foldChar(ch, opts);
    if (folded && LETTERISH.test(folded)) return { kind: 'letter', fold: folded };
    if (ch === '@' || ch === '$') return { kind: 'symbol' };
    return { kind: 'sep' };
  });

  const neighbour = (i, step) => {
    for (let k = i + step; k >= 0 && k < info.length; k += step) {
      if (info[k].kind !== 'invisible') return info[k];
    }
    return null;
  };

  info.forEach((item, i) => {
    if (item.kind !== 'digit' && item.kind !== 'symbol') return;
    const prev = neighbour(i, -1);
    const next = neighbour(i, 1);
    const prevLetter = prev?.kind === 'letter';
    const nextLetter = next?.kind === 'letter';
    const leet = LEET[chars[i]] ?? (item.digit != null ? LEET[String(item.digit)] : undefined);
    if (item.kind === 'symbol') {
      item.kind = prevLetter && nextLetter ? 'letter' : 'sep';
      item.fold = LEET[chars[i]];
    } else if ((prevLetter || nextLetter) && leet) {
      item.leet = leet;
    }
  });
  return info;
}

/**
 * Build the separator-free skeleton used for keyword matching.
 * Each skeleton char remembers its source span and token so matches can be
 * mapped back to the original text and checked against word boundaries.
 */
/** Roman-Hindi spelling variants folded together: lawda/lavda, haramzada/haramjada, qutta/kutta. */
const HINGLISH_SUBST = { w: 'v', z: 'j', q: 'k' };
/** Doubled vowels that change sound in Roman Hindi: choot → chut, kameena → kamina. */
const HINGLISH_LONG_VOWEL = { o: 'u', e: 'i' };

/**
 * opts.hinglish additionally applies HINGLISH_SUBST / HINGLISH_LONG_VOWEL.
 * Also returns per-token source spans (tokStart/tokEnd).
 */
function buildSkeleton(info, opts = {}) {
  let s = '';
  const start = [];
  const end = [];
  const tok = [];
  const tokLen = [];
  const tokStart = [];
  const tokEnd = [];
  const longVowelSrc = [];
  let token = -1;
  let inToken = false;

  info.forEach((item, i) => {
    if (item.kind === 'invisible') return;
    if (item.kind === 'sep') {
      inToken = false;
      return;
    }
    if (!inToken) {
      token += 1;
      tokLen[token] = 0;
      tokStart[token] = i;
      inToken = true;
    }
    tokEnd[token] = i + 1;
    const piece = item.kind === 'digit' ? item.leet || String(item.digit ?? '') : item.fold;
    for (const raw of piece) {
      const c = opts.hinglish ? HINGLISH_SUBST[raw] || raw : raw;
      const last = s.length - 1;
      // Collapse repeats inside a word, and across single-letter spacing ("z o o m")
      const sameToken = last >= 0 && tok[last] === token;
      const spacedLetters = last >= 0 && !sameToken && tokLen[tok[last]] === 1;
      if (last >= 0 && (sameToken || spacedLetters)) {
        if (longVowelSrc[last] === c) {
          end[last] = i + 1;
          continue;
        }
        if (s[last] === c) {
          if (opts.hinglish && sameToken && HINGLISH_LONG_VOWEL[c]) {
            s = s.slice(0, last) + HINGLISH_LONG_VOWEL[c];
            longVowelSrc[last] = c;
          }
          end[last] = i + 1;
          continue;
        }
      }
      s += c;
      start.push(i);
      end.push(i + 1);
      tok.push(token);
      tokLen[token] += 1;
    }
  });
  return { s, start, end, tok, tokStart, tokEnd };
}

function skeletonOf(word, opts = {}) {
  const { chars } = toCodePoints(String(word));
  return buildSkeleton(classify(chars, opts), opts).s;
}

/* ------------------------------------------------------------------ */
/* Keyword dictionary                                                  */
/* ------------------------------------------------------------------ */

/**
 * strong – mask anywhere inside a word, or across separators when the span
 *          starts and ends on word boundaries ("insta gram", "w h a t s a p p").
 * word   – whole words only (may still be split by separators).
 * solid  – a single unbroken word only (so "insta id" keeps the "id").
 * gated  – ambiguous everyday words; masked only with contact context nearby.
 */
const KEYWORDS = [
  ['instagram', 'strong'], ['instagaram', 'strong'], ['insta', 'word'], ['instaid', 'solid'],
  ['whatsapp', 'strong'], ['watsapp', 'strong'], ['whtsapp', 'strong'], ['wtsapp', 'word'],
  ['whatsaap', 'strong'], ['vatsap', 'word'],
  ['telegram', 'strong'], ['snapchat', 'strong'], ['facebook', 'strong'], ['fesbuk', 'word'],
  ['facebuk', 'word'], ['twitter', 'strong'], ['skype', 'word'], ['discord', 'word'],
  ['fb', 'word'],
  ['wa', 'gated'], ['ig', 'gated'], ['tg', 'gated'], ['snap', 'gated'], ['signal', 'gated'],
  ['messenger', 'gated'], ['imo', 'gated'], ['x', 'gated'], ['wp', 'gated'], ['dc', 'gated'],
  ['व्हाट्सएप', 'word'], ['व्हाट्सऐप', 'word'], ['व्हाट्सअप', 'word'], ['वॉट्सऐप', 'word'],
  ['वाट्सएप', 'word'], ['वाट्सअप', 'word'], ['इंस्टाग्राम', 'word'], ['इंस्टा', 'word'],
  ['टेलीग्राम', 'word'], ['टेलिग्राम', 'word'], ['फेसबुक', 'word'], ['स्नैपचैट', 'word'],
  ['ट्विटर', 'word'], ['स्काइप', 'word'],
].map(([word, mode]) => ({ word, mode, skel: skeletonOf(word), category: CATEGORY.PLATFORM }));

const GATED_PREV = new Set([
  'on', 'pe', 'par', 'pr', 'via', 'through', 'add', 'follow', 'mera', 'meri', 'apna', 'apni',
]);
const GATED_NEXT = new Set([
  'id', 'username', 'user', 'handle', 'account', 'acc', 'number', 'no', 'num', 'pe', 'par',
  'pr', 'profile', 'link', 'dm', 'me', 'twitter', 'chat', 'call', 'karo', 'kro', 'message',
  'msg', 'नंबर', 'पे', 'पर',
]);

const HANDLE_FILLER = new Set([
  'id', 'username', 'user', 'uname', 'handle', 'name', 'naam', 'is', 'hai', 'he', 'h', 'hain',
  'my', 'mera', 'meri', 'mere', 'apna', 'apni', 'account', 'acc', 'pe', 'par', 'pr', 'on',
  'me', 'mein', 'at', 'ka', 'ki', 'ke', 'se', 'to', 'toh', 'here', 'yeh', 'ye', 'this',
  'number', 'no', 'num', 'profile', 'link', 'add', 'follow', 'dm', 'kar', 'karo', 'kro',
  'आईडी', 'है', 'मेरा', 'मेरी', 'पे', 'पर',
]);
const HANDLE_ID_WORDS = new Set(['id', 'username', 'user', 'uname', 'handle', 'name', 'naam', 'आईडी']);
/** Words that announce a handle even without a platform name ("username neha.s"). */
const HANDLE_TRIGGER_WORDS = new Set(['username', 'uname', 'handle', 'userid']);

/* ------------------------------------------------------------------ */
/* Phone numbers                                                       */
/* ------------------------------------------------------------------ */

const DIGIT_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  shunya: 0, ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, chhah: 6,
  chah: 6, saat: 7, aath: 8, aat: 8, nau: 9,
  'शून्य': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'छः': 6,
  'सात': 7, 'आठ': 8, 'नौ': 9,
};

const PHONE_SEP = /^[\s\-.()/_*,+\u00a0]$/u;
const PHONE_CONTEXT = /^(phone|mobile|mob|number|numbr|nmbr|no|num|call|contact|ph|cell|whatsapp|wa|telegram|signal|नंबर|नम्बर|फोन|मोबाइल)$/u;
const NON_PHONE_CONTEXT = /^(booking|order|txn|transaction|ref|reference|invoice|otp|code|pin|amount|amt|rs|inr|price|payment|paid|id|upi|bill|receipt)$/u;
const MOBILE_FULL = /^(?:0091|91|0)?[6-9]\d{9}$/;

/* ------------------------------------------------------------------ */
/* Regex-based detectors                                               */
/* ------------------------------------------------------------------ */

const SOCIAL_LINK_RE =
  /(?<![\p{L}\p{N}.\-])(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am|wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com|t\.me|telegram\.me|telegram\.dog|snapchat\.com|fb\.com|fb\.me|m\.facebook\.com|facebook\.com|m\.me|twitter\.com|x\.com|discord\.gg|discord\.com|skype\.com|join\.skype\.com|signal\.me|imo\.im)(?:\/[^\s]*)?/giu;

const EMAIL_RE =
  /[\p{L}\p{N}._%+-]+\s*(?:@|\(at\)|\[at\]|\{at\})\s*[\p{L}\p{N}-]+(?:\s*(?:\.|\(dot\)|\[dot\])\s*[\p{L}\p{N}-]+)*\s*(?:\.|\(dot\)|\[dot\])\s*[a-z]{2,}/giu;
const EMAIL_WORDS_RE =
  /[\p{L}\p{N}._%+-]+\s+at\s+[\p{L}\p{N}-]+\s+dot\s+(?:com|in|net|org|co|io|me)\b/giu;

const AT_HANDLE_RE = /(^|[^\p{L}\p{N}_@])(@[\p{L}_][\p{L}\p{N}._]{2,29})/gu;

/* ------------------------------------------------------------------ */
/* Core                                                                */
/* ------------------------------------------------------------------ */

function normalizeConfig(config) {
  const merged = { ...DEFAULT_CONFIG, ...(config && typeof config === 'object' ? config : {}) };
  merged.extraWords = Array.isArray(merged.extraWords)
    ? merged.extraWords.map((w) => String(w || '').trim()).filter(Boolean).slice(0, 200)
    : [];
  return merged;
}

function wordsOf(text, utf16ToCp) {
  const words = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[0];
    words.push({
      raw,
      start: utf16ToCp[m.index],
      end: utf16ToCp[m.index + raw.length],
      clean: raw
        .toLowerCase()
        .replace(/^[^\p{L}\p{N}@]+|[^\p{L}\p{M}\p{N}]+$/gu, ''),
    });
  }
  return words;
}

function wordIndexAt(words, cp) {
  return words.findIndex((w) => cp >= w.start && cp < w.end);
}

function moderateContactInfo(text, config) {
  const cfg = normalizeConfig(config);
  const original = typeof text === 'string' ? text : String(text ?? '');
  const empty = { masked: original, flagged: false, categories: [], matches: [] };
  if (!cfg.enabled || !original.trim()) return empty;

  const { chars, utf16ToCp } = toCodePoints(original);
  const maskFlags = new Array(chars.length).fill(false);
  const matches = [];

  const addSpan = (start, end, category) => {
    if (end <= start) return;
    for (let i = start; i < end; i += 1) maskFlags[i] = true;
    matches.push({ category, start, end });
  };
  const isMasked = (start, end) => {
    for (let i = start; i < end; i += 1) if (!maskFlags[i]) return false;
    return true;
  };

  const regexSpans = (re, category) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(original))) {
      const offset = m[1] !== undefined && re === AT_HANDLE_RE ? m[1].length : 0;
      const from = m.index + offset;
      const value = re === AT_HANDLE_RE ? m[2] : m[0];
      addSpan(utf16ToCp[from], utf16ToCp[from + value.length], category);
    }
  };

  if (cfg.maskLinks) regexSpans(SOCIAL_LINK_RE, CATEGORY.LINK);
  if (cfg.maskEmails) {
    regexSpans(EMAIL_RE, CATEGORY.EMAIL);
    regexSpans(EMAIL_WORDS_RE, CATEGORY.EMAIL);
  }

  const words = wordsOf(original, utf16ToCp);
  const info = classify(chars);
  const sk = buildSkeleton(info);
  const platformWordIdx = new Set();

  const keywordList = [];
  if (cfg.maskPlatforms) keywordList.push(...KEYWORDS);
  cfg.extraWords.forEach((word) => {
    const skel = skeletonOf(word);
    if (skel.length >= 2) keywordList.push({ word, mode: 'word', skel, category: CATEGORY.CUSTOM });
  });

  /** "face? Book now" is two sentences, not "facebook". Dots stay allowed (i.n.s.t.a). */
  const crossesSentence = (i, j) => {
    for (let k = i; k < j; k += 1) {
      if (sk.tok[k] === sk.tok[k + 1]) continue;
      if (/[?!,;]/.test(chars.slice(sk.end[k], sk.start[k + 1]).join(''))) return true;
    }
    return false;
  };

  const hasContactNearby = (wIdx) => {
    for (let k = wIdx + 1; k <= wIdx + 4 && k < words.length; k += 1) {
      const raw = words[k].raw;
      if (/^@\w{3,}/.test(raw) || /\d{5,}/.test(raw.replace(/[\s\-.()]/g, ''))) return true;
    }
    return false;
  };

  for (const kw of keywordList) {
    if (!kw.skel) continue;
    let from = 0;
    while (from <= sk.s.length - kw.skel.length) {
      const i = sk.s.indexOf(kw.skel, from);
      if (i === -1) break;
      from = i + 1;
      const j = i + kw.skel.length - 1;
      const tokA = sk.tok[i];
      const tokB = sk.tok[j];
      const atStart = i === 0 || sk.tok[i - 1] !== tokA;
      const atEnd = j === sk.s.length - 1 || sk.tok[j + 1] !== tokB;
      const startCp = sk.start[i];
      const endCp = sk.end[j];
      if (tokA !== tokB && crossesSentence(i, j)) continue;

      let ok = false;
      if (kw.mode === 'strong') ok = tokA === tokB || (atStart && atEnd);
      else if (kw.mode === 'word') ok = atStart && atEnd;
      else if (kw.mode === 'solid') ok = tokA === tokB && atStart && atEnd;
      else if (kw.mode === 'gated' && tokA === tokB && atStart && atEnd) {
        const wIdx = wordIndexAt(words, startCp);
        const prev = words[wIdx - 1]?.clean;
        const next = words[wIdx + 1]?.clean;
        const twitterNear = /twitter/.test(`${prev || ''} ${next || ''}`);
        ok =
          (prev && GATED_PREV.has(prev)) ||
          (next && GATED_NEXT.has(next)) ||
          twitterNear ||
          hasContactNearby(wIdx);
      }
      if (!ok) continue;
      addSpan(startCp, endCp, kw.category);
      const wIdx = wordIndexAt(words, startCp);
      const lastIdx = wordIndexAt(words, endCp - 1);
      if (wIdx >= 0) platformWordIdx.add(Math.max(wIdx, lastIdx));
    }
  }

  if (cfg.maskHandles) {
    regexSpans(AT_HANDLE_RE, CATEGORY.HANDLE);

    const triggers = new Map();
    platformWordIdx.forEach((wIdx) => triggers.set(wIdx, /:$/.test(words[wIdx]?.raw || '')));
    words.forEach((w, idx) => {
      if (HANDLE_TRIGGER_WORDS.has(w.clean)) triggers.set(idx, true);
    });

    triggers.forEach((startsWithId, wIdx) => {
      let idSeen = startsWithId;
      for (let k = wIdx + 1; k <= wIdx + 5 && k < words.length; k += 1) {
        const w = words[k];
        if (isMasked(w.start, w.end)) continue;
        if (!w.clean || /^[:=\-–>]+$/.test(w.raw)) {
          idSeen = true;
          continue;
        }
        if (HANDLE_FILLER.has(w.clean)) {
          if (HANDLE_ID_WORDS.has(w.clean) || /:$/.test(w.raw)) idSeen = true;
          continue;
        }
        const core = w.raw.replace(/[,!?;)\]]+$|\.+$/gu, '');
        const handleLike =
          /^@?[\p{L}\p{N}][\p{L}\p{M}\p{N}._]{2,29}$/u.test(core) && !/^[\d.]+$/.test(core);
        if (handleLike && (core.startsWith('@') || /[._\d]/.test(core) || idSeen)) {
          const offset = w.raw.indexOf(core);
          const startCp = w.start + Array.from(w.raw.slice(0, offset)).length;
          addSpan(startCp, startCp + Array.from(core).length, CATEGORY.HANDLE);
        }
        break;
      }
    });
  }

  if (cfg.maskPhones) {
    detectPhones(chars, info, words, maskFlags, matches, addSpan);
  }

  if (!matches.length) return empty;

  const masked = chars.map((c, i) => (maskFlags[i] && c !== '\n' && c !== '\r' ? '*' : c)).join('');
  const categories = [...new Set(matches.map((m) => m.category))];
  return {
    masked,
    flagged: masked !== original,
    categories,
    matches: matches.map(({ category, start, end }) => ({ category, start, end })),
  };
}

function detectPhones(chars, info, words, maskFlags, matches, addSpan) {
  const items = [];
  for (let i = 0; i < chars.length; ) {
    const kind = info[i].kind;
    if (kind === 'digit' && info[i].digit != null) {
      items.push({ digit: info[i].digit, start: i, end: i + 1, numeral: true });
      i += 1;
    } else if (kind === 'letter') {
      let j = i;
      while (j < chars.length && (info[j].kind === 'letter' || info[j].kind === 'invisible')) j += 1;
      const word = chars.slice(i, j).join('').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(DIGIT_WORDS, word)) {
        items.push({ digit: DIGIT_WORDS[word], start: i, end: j, numeral: false });
      }
      i = j;
    } else {
      i += 1;
    }
  }
  if (!items.length) return;

  const runs = [];
  let run = [items[0]];
  for (let k = 1; k < items.length; k += 1) {
    const prev = items[k - 1];
    const cur = items[k];
    const gap = chars.slice(prev.end, cur.start);
    const joinable =
      gap.length <= 3 &&
      gap.every((c) => PHONE_SEP.test(c)) &&
      // digit words need an actual separator, numerals may touch each other
      (gap.length > 0 || (prev.numeral && cur.numeral));
    if (joinable) run.push(cur);
    else {
      runs.push(run);
      run = [cur];
    }
  }
  runs.push(run);

  const isLetter = (idx) => idx >= 0 && idx < chars.length && info[idx].kind === 'letter';
  const letterRunBefore = (idx) => {
    let k = idx - 1;
    while (k >= 0 && info[k].kind === 'letter') k -= 1;
    return chars.slice(k + 1, idx).join('').toLowerCase();
  };
  const priorWords = (cp, n) => {
    const idx = words.findIndex((w) => w.end > cp);
    const upto = idx === -1 ? words.length : idx;
    return words.slice(Math.max(0, upto - n), upto).map((w) => w.clean);
  };
  const platformBefore = (cp) =>
    matches.some(
      (m) =>
        (m.category === CATEGORY.PLATFORM || m.category === CATEGORY.CUSTOM) &&
        m.end <= cp &&
        cp - m.end <= 40
    );

  for (const r of runs) {
    const digits = r.map((it) => it.digit).join('');
    if (digits.length < 8) continue;

    let start = r[0].start;
    const end = r[r.length - 1].end;
    let p = start - 1;
    while (p >= 0 && /\s/.test(chars[p])) p -= 1;
    const hasPlus = p >= 0 && chars[p] === '+';
    if (hasPlus) start = p;

    const allNumerals = r.every((it) => it.numeral);
    const gluedContext = PHONE_CONTEXT.test(letterRunBefore(r[0].start));
    if (allNumerals && ((isLetter(r[0].start - 1) && !gluedContext) || isLetter(end))) continue;

    const before = priorWords(r[0].start, 4);
    const charBefore = chars[(hasPlus ? p : r[0].start) - 1];
    const negative =
      before.some((w) => NON_PHONE_CONTEXT.test(w)) || charBefore === '#' || /[₹$€£]/.test(charBefore || '');
    const positive =
      gluedContext || before.some((w) => PHONE_CONTEXT.test(w)) || platformBefore(r[0].start);

    const internalGaps = r.some((it, k) => k > 0 && it.start !== r[k - 1].end);

    if (MOBILE_FULL.test(digits) && (!negative || positive)) {
      addSpan(start, end, CATEGORY.PHONE);
    } else if (
      digits.length <= 15 &&
      ((hasPlus && digits.length >= 8 && !negative) || (positive && digits.length >= 10))
    ) {
      addSpan(start, end, CATEGORY.PHONE);
    } else if (digits.length > 13 && internalGaps && !negative) {
      const re = /(?:91)?[6-9]\d{9}/g;
      let m;
      while ((m = re.exec(digits))) {
        const first = r[m.index];
        const last = r[m.index + m[0].length - 1];
        const alignedStart = m.index === 0 || first.start !== r[m.index - 1].end;
        const nextItem = r[m.index + m[0].length];
        const alignedEnd = !nextItem || nextItem.start !== last.end;
        if (alignedStart && alignedEnd) addSpan(first.start, last.end, CATEGORY.PHONE);
      }
    }
  }
}

module.exports = {
  CATEGORY,
  DEFAULT_CONFIG,
  moderateContactInfo,
  normalizeConfig,
  skeletonOf,
  toCodePoints,
  classify,
  buildSkeleton,
};
