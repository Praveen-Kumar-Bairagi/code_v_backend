'use strict';

/**
 * Abusive-language detection for chat (English, Hindi, Hinglish).
 *
 * Pure and synchronous. Returns code-point spans with category + severity so
 * the chat moderation engine can merge them with contact-info spans.
 *
 * Severity: 1 mild (mask only) · 2 severe abuse/harassment · 3 threats/hate.
 */

const { toCodePoints, classify, buildSkeleton, skeletonOf } = require('./contactModeration');

const ABUSE_CATEGORY = {
  PROFANITY: 'profanity',
  INSULT: 'insult',
  HARASSMENT: 'harassment',
  HATE: 'hate_speech',
  THREAT: 'threat',
};

const SEVERITY = { MILD: 1, SEVERE: 2, CRITICAL: 3 };

const OPTS = { unifyIL: false, hinglish: true };
const norm = (w) => skeletonOf(w, OPTS);

const P = ABUSE_CATEGORY.PROFANITY;
const I = ABUSE_CATEGORY.INSULT;
const H = ABUSE_CATEGORY.HARASSMENT;
const X = ABUSE_CATEGORY.HATE;
const T = ABUSE_CATEGORY.THREAT;

/*
 * Matching modes
 *   word      – whole word (may be split by separators: "c h u t i y a")
 *   prefix    – word starting with the term; masks the whole word (fucking, idiots)
 *   strong    – anywhere inside a word; masks the whole word (tumadarchod)
 *   addressed – whole word, only when aimed at someone (tu kutta / you fool),
 *               for words with an everyday meaning (dog, donkey, rooster…)
 */
const DICTIONARY = [
  // ---- English profanity
  ['fuck', P, 2, 'prefix'], ['fck', P, 2, 'prefix'], ['fuk', P, 2, 'prefix'], ['phuck', P, 2, 'prefix'],
  ['motherfucker', P, 2, 'strong'], ['motherfuker', P, 2, 'strong'], ['mofo', P, 2, 'word'],
  ['shit', P, 1, 'word'], ['shitty', P, 1, 'word'], ['bullshit', P, 1, 'word'], ['shithead', P, 2, 'word'],
  ['crap', P, 1, 'word'], ['wtf', P, 1, 'word'], ['stfu', P, 1, 'word'], ['gtfo', P, 1, 'word'],
  ['bitch', P, 2, 'prefix'], ['biatch', P, 2, 'word'], ['bastard', P, 2, 'prefix'],
  ['asshole', P, 2, 'prefix'], ['arsehole', P, 2, 'prefix'], ['dumbass', I, 1, 'word'],
  ['jackass', I, 1, 'word'], ['dickhead', P, 2, 'word'], ['cunt', P, 2, 'prefix'],
  ['twat', P, 2, 'word'], ['wanker', P, 2, 'prefix'], ['slut', H, 2, 'prefix'], ['whore', H, 2, 'prefix'],
  ['douche', P, 1, 'prefix'], ['bloody', P, 1, 'addressed'], ['ass', P, 1, 'addressed'],
  ['dick', P, 2, 'addressed'], ['cock', P, 2, 'addressed'], ['pussy', P, 2, 'addressed'],
  ['prick', P, 2, 'addressed'], ['hoe', H, 2, 'addressed'], ['jerk', I, 1, 'addressed'],

  // ---- English insults
  ['idiot', I, 1, 'prefix'], ['stupid', I, 1, 'prefix'], ['dumb', I, 1, 'word'], ['moron', I, 1, 'prefix'],
  ['imbecile', I, 1, 'prefix'], ['loser', I, 1, 'addressed'], ['fool', I, 1, 'addressed'],
  ['ugly', I, 1, 'addressed'], ['retard', I, 2, 'prefix'], ['scumbag', I, 2, 'word'],
  ['worthless', I, 1, 'addressed'], ['pervert', H, 2, 'addressed'],

  // ---- Body shaming / gender-based / sexual harassment
  ['fatso', H, 2, 'word'], ['fatty', H, 2, 'addressed'], ['moti', H, 2, 'addressed'],
  ['kalua', H, 2, 'word'], ['hathni', H, 2, 'addressed'], ['bhains', H, 2, 'addressed'],
  ['tharki', H, 2, 'word'], ['boobs', H, 2, 'word'], ['tits', H, 2, 'word'],
  ['chudai', H, 2, 'prefix'], ['chudva', H, 2, 'prefix'], ['chudakad', H, 2, 'prefix'],
  ['chakka', X, 2, 'addressed'], ['hijra', X, 2, 'addressed'], ['tranny', X, 2, 'word'],

  // ---- Hindi / Hinglish gaali (Roman)
  ['madarchod', P, 2, 'strong'], ['maderchod', P, 2, 'strong'], ['madharchod', P, 2, 'strong'],
  ['madarjat', P, 2, 'strong'], ['behenchod', P, 2, 'strong'], ['bahenchod', P, 2, 'strong'],
  ['bhenchod', P, 2, 'strong'], ['benchod', P, 2, 'strong'], ['bhanchod', P, 2, 'strong'],
  ['behnchod', P, 2, 'strong'], ['mc', P, 2, 'addressed'], ['bc', P, 2, 'addressed'],
  ['bkl', P, 2, 'word'], ['bsdk', P, 2, 'word'], ['mkc', P, 2, 'word'], ['mkb', P, 2, 'word'],
  ['bhosd', P, 2, 'prefix'], ['bhosad', P, 2, 'prefix'], ['bhosri', P, 2, 'prefix'],
  ['chutiy', P, 2, 'prefix'], ['chutia', P, 2, 'word'], ['chut', P, 2, 'word'],
  ['lund', P, 2, 'word'], ['lauda', P, 2, 'word'], ['lavda', P, 2, 'word'], ['loda', P, 2, 'word'],
  ['lode', P, 2, 'word'], ['lodu', P, 2, 'word'], ['laude', P, 2, 'word'], ['lavde', P, 2, 'word'],
  ['lavdi', P, 2, 'word'], ['gaand', P, 2, 'word'], ['gand', P, 2, 'word'], ['gandu', P, 2, 'prefix'],
  ['gaandu', P, 2, 'prefix'], ['jhaant', P, 2, 'prefix'], ['jhant', P, 2, 'prefix'],
  ['jhaatu', P, 2, 'word'], ['jhatu', P, 2, 'word'], ['tatte', P, 2, 'word'], ['tatti', P, 1, 'word'],
  ['chodu', P, 2, 'word'], ['randi', H, 2, 'prefix'], ['raand', H, 2, 'word'], ['randva', H, 2, 'word'],
  ['chinal', H, 2, 'word'], ['dalla', H, 2, 'word'], ['bhadva', H, 2, 'prefix'], ['bhadve', H, 2, 'prefix'],
  ['harami', P, 2, 'prefix'], ['haramkhor', P, 2, 'prefix'], ['haramjad', P, 2, 'prefix'],
  ['kamina', I, 1, 'word'], ['kamine', I, 1, 'word'], ['kaminey', I, 1, 'word'], ['kamini', I, 1, 'word'],
  ['nalayak', I, 1, 'word'], ['bevakoof', I, 1, 'word'], ['bevkoof', I, 1, 'word'], ['bevkuf', I, 1, 'word'],
  ['bevakuf', I, 1, 'word'], ['gadha', I, 1, 'addressed'], ['gadhe', I, 1, 'addressed'],
  ['ullu', I, 1, 'addressed'], ['murkh', I, 1, 'addressed'], ['jahil', I, 1, 'addressed'],
  ['ganvar', I, 1, 'addressed'], ['gavar', I, 1, 'addressed'],
  ['kutta', I, 2, 'addressed'], ['kutte', I, 2, 'addressed'], ['kutti', I, 2, 'addressed'],
  ['kutiya', I, 2, 'word'], ['suar', I, 2, 'addressed'], ['suvar', I, 2, 'addressed'],
  ['chodunga', T, 3, 'word'], ['chodenge', T, 3, 'word'],

  // ---- Caste / religious / racial slurs
  ['chamar', X, 3, 'word'], ['chamaar', X, 3, 'word'], ['bhangi', X, 3, 'word'], ['chuhra', X, 3, 'word'],
  ['katua', X, 3, 'word'], ['katva', X, 3, 'word'], ['katue', X, 3, 'word'], ['katve', X, 3, 'word'],
  ['mulle', X, 3, 'word'], ['mulla', X, 3, 'addressed'], ['jihadi', X, 3, 'addressed'],
  ['paki', X, 3, 'word'], ['nigger', X, 3, 'prefix'], ['nigga', X, 2, 'prefix'], ['chink', X, 3, 'addressed'],
  ['faggot', X, 3, 'prefix'], ['fag', X, 2, 'addressed'], ['kike', X, 3, 'word'], ['towelhead', X, 3, 'word'],

  // ---- Threat words that stand alone
  ['kys', T, 3, 'word'],

  // ---- Devanagari
  ['मादरचोद', P, 2, 'strong'], ['मादर', P, 2, 'addressed'], ['बहनचोद', P, 2, 'strong'],
  ['बहनचोद', P, 2, 'strong'], ['भेनचोद', P, 2, 'strong'], ['भोसडीके', P, 2, 'strong'],
  ['भोसड़ीके', P, 2, 'strong'], ['भोसड़ी', P, 2, 'strong'], ['भोसडा', P, 2, 'strong'],
  ['चूतिया', P, 2, 'strong'], ['चुतिया', P, 2, 'strong'], ['चूतिये', P, 2, 'strong'], ['चूत', P, 2, 'word'],
  ['लंड', P, 2, 'word'], ['लौड़ा', P, 2, 'word'], ['लौडा', P, 2, 'word'], ['लोड़ा', P, 2, 'word'],
  ['लवड़ा', P, 2, 'word'], ['लौड़े', P, 2, 'word'], ['गांड', P, 2, 'word'], ['गाँड', P, 2, 'word'],
  ['गांडू', P, 2, 'word'], ['गाँडू', P, 2, 'word'], ['झाटू', P, 2, 'word'], ['झांट', P, 2, 'word'],
  ['रंडी', H, 2, 'word'], ['छिनाल', H, 2, 'word'], ['भड़वा', H, 2, 'word'], ['भडवा', H, 2, 'word'],
  ['हरामी', P, 2, 'word'], ['हरामज़ादा', P, 2, 'word'], ['हरामजादा', P, 2, 'word'], ['हरामखोर', P, 2, 'word'],
  ['कमीना', I, 1, 'word'], ['कमीने', I, 1, 'word'], ['बेवकूफ', I, 1, 'word'], ['बेवकूफ़', I, 1, 'word'],
  ['कुतिया', I, 2, 'word'], ['कुत्ता', I, 2, 'addressed'], ['कुत्ते', I, 2, 'addressed'],
  ['सूअर', I, 2, 'addressed'], ['गधा', I, 1, 'addressed'], ['गधे', I, 1, 'addressed'],
  ['उल्लू', I, 1, 'addressed'], ['मूर्ख', I, 1, 'addressed'], ['हिजड़ा', X, 2, 'addressed'],
  ['छक्का', X, 2, 'addressed'], ['चमार', X, 3, 'word'], ['भंगी', X, 3, 'word'], ['कटुआ', X, 3, 'word'],
  ['कटुए', X, 3, 'word'], ['मुल्ले', X, 3, 'word'],
];

/** Words that make an ambiguous term "aimed at someone". */
const ADDRESS_MARKERS = new Set(
  [
    'you', 'u', 'ur', 'your', 'youre', 'yourself', 'ya', 'tu', 'tum', 'tujhe', 'tujhko', 'tumhe',
    'tumko', 'tera', 'teri', 'tere', 'tumhara', 'tumhari', 'aap', 'abe', 'abey', 'oye', 'oy',
    'saale', 'sale', 'saala', 'sala', 'saali', 'kya', 'yaar', 'such', 'what',
    'तू', 'तुम', 'तुझे', 'तेरा', 'तेरी', 'तेरे', 'अबे', 'साले', 'साला',
  ].map(norm)
);
/** "mera kutta", "my dog" — possessives that always mean the literal sense. */
const POSSESSIVE_MARKERS = new Set(
  ['mera', 'meri', 'mere', 'my', 'our', 'hamara', 'hamare', 'uska', 'uski', 'unka', 'apna', 'apni',
    'pet', 'his', 'her', 'their', 'gali', 'street', 'मेरा', 'मेरी', 'हमारा'].map(norm)
);
/** "ek kutta", "wo kutta" — literal unless someone is addressed nearby. */
const DEMONSTRATIVE_MARKERS = new Set(
  ['the', 'ek', 'a', 'an', 'wo', 'woh', 'vo', 'ye', 'yeh', 'is', 'us', 'that', 'this', 'वो', 'ये', 'एक'].map(norm)
);
/** Reporting, quoting or explaining a word rather than using it. */
const EDUCATIONAL_MARKERS = new Set(
  ['mean', 'means', 'meaning', 'matlab', 'arth', 'definition', 'define', 'word', 'term', 'spelling',
    'spelled', 'quote', 'quoted', 'called', 'slur', 'slurs', 'offensive', 'gaali',
    'abusive', 'abuse', 'report', 'reported', 'complaint', 'मतलब', 'गाली'].map(norm)
);
const NEGATORS = new Set(
  ['never', 'not', 'nahi', 'nahin', 'nhi', 'na', 'mat', 'wont', 'dont', 'didnt', 'cant', 'no',
    'नहीं', 'मत'].map(norm)
);

/* ------------------------------------------------------------------ */
/* Threat / harassment phrases                                         */
/* ------------------------------------------------------------------ */

const YOU = ['you', 'u', 'ya', 'yourself', 'your', 'ur', 'youre', 'urself'];
const HINDI_TARGET = [
  'tujhe', 'tujhko', 'tereko', 'tuje', 'tumhe', 'tumko', 'tumhein', 'tera', 'teri', 'tere',
  'tumhari', 'tumhara', 'tu', 'tum', 'tuze', 'tuzhe', 'aapko', 'tujhpe',
  'तुझे', 'तुमको', 'तुम्हें', 'तेरा', 'तेरी', 'तेरे', 'तू', 'तुम',
];
const BODY = ['haddi', 'haddiyan', 'taang', 'tang', 'haath', 'hath', 'muh', 'munh', 'mooh', 'daant',
  'dant', 'sar', 'gardan', 'jabda', 'hadi'];
const HINDI_FUTURE = ['dunga', 'denge', 'doonga', 'duga', 'dalunga', 'daalunga', 'dalenge',
  'daalenge', 'dungi', 'dalungi', 'denga', 'dega', 'dalega', 'डालूंगा', 'दूंगा', 'देंगे'];
const INTENT_EN = ['i', 'im', 'imma', 'ima', 'we', 'gonna', 'wanna', 'lemme'];

/**
 * steps: [{ any: [...words, 'prefix*'], gap: maxWordsSincePrevious, mask }]
 * target: words that must appear within ±5 words (not masked themselves).
 */
const PHRASES = [
  { cat: T, sev: 3, steps: [
    { any: INTENT_EN, mask: false },
    { any: ['kill*', 'murder*', 'shoot', 'stab*', 'strangle*', 'choke', 'behead', 'slit', 'burn'], gap: 4 },
    { any: YOU, gap: 2 },
  ] },
  { cat: T, sev: 2, steps: [
    { any: INTENT_EN, mask: false },
    { any: ['slap', 'punch', 'smack'], gap: 4 },
    { any: YOU, gap: 2 },
  ] },
  { cat: T, sev: 2, steps: [{ any: ['beat'] }, { any: YOU, gap: 1 }, { any: ['up'], gap: 1 }] },
  { cat: T, sev: 3, steps: [
    { any: ['you', 'u'] },
    { any: ['will', 'gonna', 'll', 'shall', 'are'], gap: 2, mask: false },
    { any: ['die', 'dead'], gap: 2 },
  ] },
  { cat: T, sev: 3, steps: [{ any: ['kill*'] }, { any: ['yourself', 'urself', 'yourselves'], gap: 1 }] },
  { cat: T, sev: 3, steps: [{ any: ['rape*', 'balatkar*', 'बलात्कार'] }], target: [...YOU, ...HINDI_TARGET, ...INTENT_EN, ...HINDI_FUTURE] },
  { cat: T, sev: 3, steps: [
    { any: ['acid', 'तेजाब', 'tejab', 'tezab'] },
    { any: ['phek*', 'phenk*', 'fek*', 'fenk*', 'daal*', 'dal*', 'throw*'], gap: 3 },
  ] },
  { cat: T, sev: 3, steps: [
    { any: ['jaan', 'jan', 'जान'] },
    { any: ['se', 'से'], gap: 1, mask: false },
    { any: ['maar*', 'mar*', 'khatam*', 'khatm*', 'मार*'], gap: 1 },
  ] },
  { cat: T, sev: 3, steps: [
    { any: ['maar', 'mar', 'maarunga', 'marunga', 'maardunga', 'mardunga', 'mardalunga', 'maardalunga',
      'mardenge', 'mardalenge', 'marenge', 'मार', 'मारूंगा', 'मारुंगा'] },
    { any: HINDI_FUTURE, gap: 1, optional: true },
  ], target: HINDI_TARGET, needsFuture: true },
  { cat: T, sev: 3, steps: [
    { any: ['goli', 'गोली'] },
    { any: ['maar*', 'mar*', 'chala*', 'मार*'], gap: 2 },
  ], target: HINDI_TARGET },
  { cat: T, sev: 3, steps: [
    { any: ['chaku', 'chakku', 'chhura', 'chura', 'knife', 'चाकू'] },
    { any: ['maar*', 'mar*', 'ghus*', 'ghop*', 'ghonp*', 'मार*'], gap: 3 },
  ], target: HINDI_TARGET },
  { cat: T, sev: 3, steps: [
    { any: ['khatam', 'khatm', 'khtm', 'खत्म', 'ख़त्म'] },
    { any: ['kar', 'kr', 'कर'], gap: 1, mask: false },
    { any: HINDI_FUTURE, gap: 1 },
  ], target: HINDI_TARGET },
  { cat: T, sev: 3, steps: [
    { any: ['tod', 'tor', 'todd', 'तोड़', 'तोड'] },
    { any: HINDI_FUTURE, gap: 1 },
  ], target: [...HINDI_TARGET, ...BODY] },
  { cat: T, sev: 2, steps: [
    { any: ['dekh', 'देख'] },
    { any: ['lunga', 'lenge', 'loonga', 'lungi', 'lega', 'लूंगा', 'लेंगे'], gap: 1 },
  ], target: HINDI_TARGET },
  { cat: T, sev: 3, steps: [
    { any: ['utha', 'uthva', 'uthwa', 'utva', 'उठवा', 'उठा'] },
    { any: ['lunga', 'lenge', 'loonga', 'dunga', 'denge', 'लूंगा', 'दूंगा'], gap: 1 },
  ], target: HINDI_TARGET },
  { cat: T, sev: 3, steps: [
    { any: ['jala', 'jla', 'जला'] },
    { any: HINDI_FUTURE, gap: 1 },
  ], target: HINDI_TARGET },
  { cat: T, sev: 3, steps: [
    { any: ['aag', 'आग'] },
    { any: ['laga', 'lga', 'लगा'], gap: 1 },
    { any: HINDI_FUTURE, gap: 1 },
  ], target: HINDI_TARGET },
  { cat: I, sev: 2, steps: [
    { any: ['ullu', 'ulloo', 'उल्लू'] },
    { any: ['ka', 'ke', 'की', 'का', 'के'], gap: 1, mask: false },
    { any: ['patha', 'pattha', 'patta', 'pathe', 'patthe', 'पट्ठा', 'पट्ठे'], gap: 1 },
  ] },
  { cat: T, sev: 2, steps: [
    { any: ['go', 'ja', 'jaa', 'जा'] },
    { any: ['die', 'mar', 'marja', 'मर'], gap: 1 },
  ] },
  { cat: H, sev: 2, steps: [
    { any: ['send', 'bhej*', 'show', 'dikha*', 'भेज*', 'दिखा*'] },
    { any: ['nude*', 'nangi', 'naked', 'boob*', 'tits', 'bra', 'panty', 'panties', 'नंगी'], gap: 3 },
  ] },
  { cat: H, sev: 2, steps: [
    { any: ['sex', 'सेक्स'] },
    { any: ['kar*', 'kr*', 'chahiye', 'chaiye', 'karegi', 'karogi', 'krogi', 'करोगी', 'करेगी'], gap: 1 },
  ] },
  { cat: H, sev: 2, steps: [
    { any: ['sleep', 'sex', 'hookup'] },
    { any: ['with'], gap: 1, mask: false },
    { any: ['me'], gap: 1, mask: false },
  ] },
  { cat: P, sev: 2, steps: [
    { any: ['maa', 'ma', 'behen', 'bahen', 'bhen', 'behan', 'माँ', 'मां', 'बहन'] },
    { any: ['chod*', 'चोद*'], gap: 2 },
  ] },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function compileAlternatives(list) {
  const exact = new Set();
  const prefixes = [];
  list.forEach((raw) => {
    const isPrefix = raw.endsWith('*');
    const n = norm(isPrefix ? raw.slice(0, -1) : raw);
    if (!n) return;
    if (isPrefix) prefixes.push(n);
    else exact.add(n);
  });
  return (word) => exact.has(word) || prefixes.some((p) => word.startsWith(p));
}

const COMPILED_PHRASES = PHRASES.map((p) => ({
  ...p,
  steps: p.steps.map((s) => ({ ...s, test: compileAlternatives(s.any) })),
  targetTest: p.target ? compileAlternatives(p.target) : null,
  futureTest: p.needsFuture ? compileAlternatives(HINDI_FUTURE) : null,
}));

function compileDictionary(entries) {
  return entries
    .map(([term, category, severity, mode]) => ({ term, category, severity, mode, skel: norm(term) }))
    .filter((e) => e.skel.length >= 2);
}

const BUILTIN_TERMS = compileDictionary(DICTIONARY);
const ROMAN_TERMS = BUILTIN_TERMS.filter((e) => /^[a-z]+$/.test(e.term));

/* ------------------------------------------------------------------ */
/* Detection                                                           */
/* ------------------------------------------------------------------ */

/**
 * @param {string} text
 * @param {{ customTerms?: {word:string,category?:string,severity?:number}[], allowedWords?: string[],
 *           categories?: Record<string, boolean> }} options
 * @returns {{ start:number, end:number, category:string, severity:number, educational:boolean }[]}
 */
function detectAbuse(text, options = {}) {
  const original = typeof text === 'string' ? text : String(text ?? '');
  if (!original.trim()) return [];

  const enabled = (cat) => options.categories?.[cat] !== false;
  const allowed = new Set((options.allowedWords || []).map(norm).filter(Boolean));

  const custom = compileDictionary(
    (options.customTerms || []).map((t) => {
      const word = String(t.word || '').trim();
      const isPrefix = word.endsWith('*');
      const category = Object.values(ABUSE_CATEGORY).includes(t.category) ? t.category : P;
      const severity = [1, 2, 3].includes(Number(t.severity)) ? Number(t.severity) : 2;
      return [isPrefix ? word.slice(0, -1) : word, category, severity, isPrefix ? 'prefix' : 'word'];
    })
  );
  const terms = [...BUILTIN_TERMS, ...custom].filter((e) => !allowed.has(e.skel) && enabled(e.category));

  const { chars } = toCodePoints(original);
  const info = classify(chars, OPTS);
  const sk = buildSkeleton(info, OPTS);

  const tokens = sk.tokStart.map((start, t) => {
    const end = sk.tokEnd[t];
    return { start, end, norm: norm(chars.slice(start, end).join('')) };
  });
  const tokenAt = (cp) => tokens.findIndex((t) => cp >= t.start && cp < t.end);

  const educational =
    tokens.some((t) => EDUCATIONAL_MARKERS.has(t.norm)) || /["“”«»]/.test(original);

  const isAddressed = (firstTok, lastTok) => {
    const prev = tokens[firstTok - 1]?.norm;
    if (prev && POSSESSIVE_MARKERS.has(prev)) return false;
    for (let k = Math.max(0, firstTok - 3); k <= Math.min(tokens.length - 1, lastTok + 3); k += 1) {
      if (k >= firstTok && k <= lastTok) continue;
      if (ADDRESS_MARKERS.has(tokens[k].norm)) return true;
    }
    if (prev && DEMONSTRATIVE_MARKERS.has(prev)) return false;
    // Vocative: "kutte!", "chup kar kutte", or a short insult on its own
    const after = chars.slice(tokens[lastTok].end, tokens[lastTok].end + 2).join('');
    if (/^\s*[!,]/.test(after)) return true;
    if (tokens.length <= 2) return true;
    return lastTok === tokens.length - 1 && firstTok > 0;
  };

  const crossesSentence = (i, j) => {
    for (let k = i; k < j; k += 1) {
      if (sk.tok[k] === sk.tok[k + 1]) continue;
      if (/[?!,;]/.test(chars.slice(sk.end[k], sk.start[k + 1]).join(''))) return true;
    }
    return false;
  };

  /** "c h u t i y a": a match ending on a lone letter swallows the following lone letters. */
  const spacedTail = (t) => {
    let k = t;
    const single = (x) => x < tokens.length && tokens[x].end - tokens[x].start === 1;
    if (!single(k)) return sk.tokEnd[k];
    while (single(k + 1) && !/[?!,;]/.test(chars.slice(tokens[k].end, tokens[k + 1].start).join(''))) k += 1;
    return sk.tokEnd[k];
  };

  const matches = [];
  const add = (start, end, category, severity) => {
    if (end > start) matches.push({ start, end, category, severity });
  };

  for (const term of terms) {
    let from = 0;
    while (from <= sk.s.length - term.skel.length) {
      const i = sk.s.indexOf(term.skel, from);
      if (i === -1) break;
      from = i + 1;
      const j = i + term.skel.length - 1;
      const tokA = sk.tok[i];
      const tokB = sk.tok[j];
      if (tokA !== tokB && crossesSentence(i, j)) continue;
      const atStart = i === 0 || sk.tok[i - 1] !== tokA;
      const atEnd = j === sk.s.length - 1 || sk.tok[j + 1] !== tokB;

      let ok = false;
      let start = sk.start[i];
      let end = sk.end[j];
      if (term.mode === 'word') ok = atStart && atEnd;
      else if (term.mode === 'prefix') {
        ok = atStart;
        end = spacedTail(tokB);
      } else if (term.mode === 'strong') {
        ok = tokA === tokB || (atStart && atEnd);
        start = sk.tokStart[tokA];
        end = spacedTail(tokB);
      } else if (term.mode === 'addressed') {
        ok = atStart && atEnd && isAddressed(tokA, tokB);
      }
      if (ok) add(start, end, term.category, term.severity);
    }
  }

  // Self-censored spellings: f*ck, b***h, ch*tiya, sh!t
  const wordRe = /\S+/g;
  let wm;
  while ((wm = wordRe.exec(original))) {
    const core = wm[0].replace(/^[^\p{L}*#%!]+|[^\p{L}*#%]+$/gu, '').toLowerCase();
    if (!/[*#%!]/.test(core) || !/^[a-z*#%!@$]+$/.test(core)) continue;
    const letters = core.replace(/[^a-z]/g, '');
    const fStar = /^f[*#%]{2,3}k?$/.test(core);
    if (letters.length < 2 && !fStar) continue;
    const pattern = new RegExp(
      `^${core.replace(/[*#%!@$]+/g, '[a-z]{1,4}')}${fStar ? '' : '[a-z]*'}$`
    );
    const hit = fStar
      ? ROMAN_TERMS.find((t) => t.term === 'fuck')
      : ROMAN_TERMS.find(
          (t) => t.mode !== 'addressed' && pattern.test(t.term) && !allowed.has(t.skel) && enabled(t.category)
        );
    if (!hit) continue;
    const offset = wm[0].toLowerCase().indexOf(core);
    const startCp = Array.from(original.slice(0, wm.index + offset)).length;
    add(startCp, startCp + Array.from(core).length, hit.category, hit.severity);
  }

  // Phrase rules (threats, harassment)
  for (const phrase of COMPILED_PHRASES) {
    if (!enabled(phrase.cat)) continue;
    for (let s0 = 0; s0 < tokens.length; s0 += 1) {
      if (!phrase.steps[0].test(tokens[s0].norm)) continue;
      const hits = [{ k: s0, step: phrase.steps[0] }];
      let prev = s0;
      let ok = true;
      for (let st = 1; st < phrase.steps.length; st += 1) {
        const step = phrase.steps[st];
        let found = -1;
        for (let k = prev + 1; k <= prev + (step.gap ?? 1) && k < tokens.length; k += 1) {
          if (step.test(tokens[k].norm)) {
            found = k;
            break;
          }
        }
        if (found === -1) {
          if (step.optional) continue;
          ok = false;
          break;
        }
        hits.push({ k: found, step });
        prev = found;
      }
      if (!ok) continue;

      const hitIdx = hits.map((h) => h.k);
      const first = hitIdx[0];
      const last = hitIdx[hitIdx.length - 1];
      const window = tokens.slice(Math.max(0, first - 5), Math.min(tokens.length, last + 6));
      if (phrase.targetTest && !window.some((t) => phrase.targetTest(t.norm))) continue;
      if (
        phrase.futureTest &&
        !phrase.futureTest(tokens[first].norm) &&
        !hitIdx.slice(1).some((k) => phrase.futureTest(tokens[k].norm)) &&
        !/(unga|enge|ungi|oonga)$/.test(tokens[first].norm)
      ) {
        continue;
      }
      if (phrase.cat === T) {
        const negWindow = tokens.slice(Math.max(0, first - 3), last + 2);
        if (negWindow.some((t) => NEGATORS.has(t.norm))) continue;
      }

      hits.forEach(({ k, step }) => {
        if (step.mask !== false) add(tokens[k].start, tokens[k].end, phrase.cat, phrase.sev);
      });
    }
  }

  return matches.map((m) => ({
    ...m,
    educational,
    severity: educational ? Math.min(m.severity, SEVERITY.MILD) : m.severity,
  }));
}

module.exports = {
  ABUSE_CATEGORY,
  SEVERITY,
  DICTIONARY,
  detectAbuse,
  normalizeAbuseWord: norm,
};
