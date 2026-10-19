'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { moderateChatMessage } = require('../src/utils/chatModerationEngine');

const run = (text, config) => moderateChatMessage(text, config);

function expectMasked(text, expected, { category, severity } = {}) {
  const r = run(text);
  if (expected !== undefined) assert.equal(r.masked, expected, `masked output for: ${text}`);
  else assert.notEqual(r.masked, text, `should be masked: ${text}`);
  assert.ok(r.flagged, `should be flagged: ${text}`);
  if (category) assert.ok(r.categories.includes(category), `${text} → ${r.categories}`);
  if (severity) assert.equal(r.severity, severity, `severity for: ${text}`);
  return r;
}

function expectClean(text) {
  const r = run(text);
  assert.equal(r.masked, text, `should not change: ${text}`);
  assert.equal(r.flagged, false, `should not flag: ${text}`);
}

test('spec examples mask only the abusive word', () => {
  expectMasked('You are an idiot', 'You are an *****', { category: 'insult', severity: 1 });
  expectMasked('You are stupid', 'You are ******', { category: 'insult', severity: 1 });
});

test('English profanity', () => {
  expectMasked('fuck off', '**** off', { category: 'profanity', severity: 2 });
  expectMasked('what the fucking hell', 'what the ******* hell');
  expectMasked('you bitch', 'you *****');
  expectMasked('such an asshole', 'such an *******');
  expectMasked('shit happens', '**** happens', { severity: 1 });
  expectMasked('motherfucker', '************');
});

test('Hindi (Devanagari) abuse', () => {
  expectMasked('तू चूतिया है', 'तू ****** है', { category: 'profanity', severity: 2 });
  expectMasked('तू कुत्ता है', 'तू ****** है', { category: 'insult' });
  expectMasked('हरामी', '*****');
});

test('Roman Hindi / Hinglish abuse', () => {
  expectMasked('tu chutiya hai', 'tu ******* hai', { category: 'profanity', severity: 2 });
  expectMasked('madarchod', '*********');
  expectMasked('bhenchod saale', '******** saale');
  expectMasked('bhosdike', '********');
  expectMasked('tu kutta hai', 'tu ***** hai');
  expectMasked('chup kar kutte', 'chup kar *****');
  expectMasked('ullu ka pattha', '**** ka ******');
  expectMasked('gadha hai tu', '***** hai tu');
  expectMasked('bola na chutiye', 'bola na *******');
});

test('obfuscated spellings', () => {
  expectMasked('c h u t i y a', '*************');
  expectMasked('Ch.u.t.i.y.a', '************');
  expectMasked('B H O S D I K E', '***************');
  expectMasked('madar ch0d', '**********');
  expectMasked('fuuuuck you', '******* you');
  expectMasked('FUCK', '****');
  expectMasked('f*ck off', '**** off');
  expectMasked('sh!t man', '**** man');
  expectMasked('b***h', '*****');
  expectMasked('ⅰdⅰot', undefined, { category: 'insult' });
});

test('threats are level 3 and flagged for review', () => {
  expectMasked('I will kill you', 'I will **** ***', { category: 'threat', severity: 3 });
  expectMasked('main tujhe maar dunga', 'main tujhe **** *****', { category: 'threat', severity: 3 });
  expectMasked('मैं तुझे मार दूंगा', 'मैं तुझे *** *****', { severity: 3 });
  expectMasked('tujhe goli maar dunga', undefined, { severity: 3 });
  expectMasked('jaan se maar dunga', '**** se **** dunga', { severity: 3 });
  expectMasked('tera ghar jala dunga', 'tera ghar **** *****', { severity: 3 });
  expectMasked('go kill yourself', 'go **** ********', { severity: 3 });
  expectMasked('kys', '***', { severity: 3 });
  expectMasked('I will beat you up', undefined, { category: 'threat', severity: 2 });
  expectMasked('tujhe dekh lunga', undefined, { category: 'threat' });
});

test('hate speech is level 3', () => {
  expectMasked('chamar', '******', { category: 'hate_speech', severity: 3 });
  expectMasked('saale katue', 'saale *****', { category: 'hate_speech', severity: 3 });
  expectMasked('you faggot', 'you ******', { category: 'hate_speech', severity: 3 });
});

test('harassment', () => {
  expectMasked('send nudes', '**** *****', { category: 'harassment', severity: 2 });
  expectMasked('tu randi hai', 'tu ***** hai', { category: 'harassment' });
});

test('normal conversation is untouched', () => {
  [
    'Hi, how are you?',
    'Booking kal 5 baje confirm hai',
    'Are you free on Sunday?',
    'aaj mausam bahut accha hai',
    'main thak gaya',
    'kya bakwas hai',
    'tum pagal ho kya',
    'shut up yaar',
    'I hate traffic',
    'This movie was killing it',
    'kill the lights please',
    'Please do not kill me',
    'I will not hurt you',
    'mai nahi maarunga tujhe',
    'game me maine sabko maar diya',
    'main kal dekh lunga',
    'hello bhai kaise ho',
    'Thank you so much!',
  ].forEach(expectClean);
});

test('words with an everyday meaning need context', () => {
  expectClean('mera kutta bimar hai');
  expectClean('kutta bhaunk raha hai');
  expectClean('kutta kaat lega');
  expectClean('मेरा कुत्ता बीमार है');
  expectClean('ek gadha road pe khada tha');
  expectClean('ullu raat ko jagta hai');
  expectClean('the fool on the hill');
});

test('substrings of ordinary words are not flagged (Scunthorpe problem)', () => {
  [
    'class pass',
    'grass hopper',
    'assessment done',
    'class assignment',
    'cocktail party',
    'Dickens novel',
    'scunthorpe',
    'Shital is coming',
    'dick tracy movie',
    'Sussex and Essex',
    'shiitake mushrooms',
    'analysis report',
    'butter scotch',
    'title of the book',
  ].forEach(expectClean);
});

test('educational / quoted use is masked but never severe', () => {
  const r1 = expectMasked('what does chutiya mean?', 'what does ******* mean?');
  assert.equal(r1.severity, 1);
  assert.ok(r1.educational);
  const r2 = expectMasked('he called me an idiot', 'he called me an *****');
  assert.equal(r2.severity, 1);
  const r3 = expectMasked('He wrote "madarchod" in chat, I want to report it');
  assert.equal(r3.severity, 1);
});

test('admin config: category toggles, custom terms and allowed words', () => {
  assert.equal(run('You are an idiot', { maskInsults: false }).masked, 'You are an idiot');
  assert.equal(run('fuck off', { maskProfanity: false }).masked, 'fuck off');
  assert.equal(run('I will kill you', { maskThreats: false }).masked, 'I will kill you');

  const custom = run('tu toxicwala hai', {
    customTerms: [{ word: 'toxicwala', category: 'insult', severity: 2 }],
  });
  assert.equal(custom.masked, 'tu ********* hai');
  assert.equal(custom.severity, 2);

  assert.equal(run('You are stupid', { allowedWords: ['stupid'] }).masked, 'You are stupid');
  assert.equal(run('anything goes idiot', { enabled: false }).masked, 'anything goes idiot');
});

test('contact info and abuse are merged into one result', () => {
  const r = run('idiot call me on 9876543210 or insta');
  assert.equal(r.masked, '***** call me on ********** or *****');
  assert.deepEqual(new Set(r.categories), new Set(['insult', 'contact_info', 'social_media']));
  assert.equal(r.severity, 1);
});

test('masking is idempotent and preserves length / newlines', () => {
  const text = 'tu chutiya hai\nI will kill you';
  const once = run(text).masked;
  assert.equal(Array.from(once).length, Array.from(text).length);
  assert.ok(once.includes('\n'));
  assert.equal(run(once).masked, once);
});

test('results never leak the original abusive text', () => {
  const r = run('tu madarchod hai, I will kill you');
  const meta = JSON.stringify({ ...r, masked: undefined });
  assert.ok(!/madarchod|kill/i.test(meta));
});
