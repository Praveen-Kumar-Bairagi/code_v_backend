'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { moderateContactInfo, CATEGORY } = require('../src/utils/contactModeration');

const mask = (text, config) => moderateContactInfo(text, config).masked;
const stars = (s) => '*'.repeat(Array.from(s).length);

function assertHidden(text, secret, config) {
  const out = mask(text, config);
  assert.ok(!out.includes(secret), `"${secret}" leaked in: ${out}`);
  return out;
}

function assertUnchanged(text) {
  const res = moderateContactInfo(text);
  assert.equal(res.masked, text, `expected unchanged, got: ${res.masked}`);
  assert.equal(res.flagged, false);
}

test('spec examples', () => {
  assert.equal(mask('Contact me on Instagram'), `Contact me on ${stars('Instagram')}`);
  assert.equal(
    mask('My WhatsApp number is 9876543210'),
    `My ${stars('WhatsApp')} number is ${stars('9876543210')}`
  );
  assert.equal(mask('Follow me on telegram'), `Follow me on ${stars('telegram')}`);
  assert.equal(mask('My insta ID is praveen_123'), `My ${stars('insta')} ID is ${stars('praveen_123')}`);
  assert.equal(
    mask('WhatsApp me at +91 9876543210'),
    `${stars('WhatsApp')} me at ${stars('+91 9876543210')}`
  );
});

test('Instagram username sharing', () => {
  assertHidden('my instagram is @praveen.dev', 'praveen.dev');
  assertHidden('insta id: rahul_99', 'rahul_99');
  assertHidden('IG id riya.k follow karo', 'riya.k');
  assertHidden('instagram.com/praveen_123', 'praveen_123');
  assertHidden('mera insta handle priya hai', 'priya');
});

test('WhatsApp number sharing', () => {
  assertHidden('whatsapp karo 98765 43210', '43210');
  assertHidden('WA pe msg karo 9876543210', '9876543210');
  assertHidden('wa.me/919876543210', '9876543210');
  assertHidden('व्हाट्सएप नंबर 9876543210 है', '9876543210');
  const out = mask('व्हाट्सएप पे मैसेज करो');
  assert.ok(!out.includes('व्हाट्सएप'));
});

test('Telegram username sharing', () => {
  assertHidden('telegram id @cool_guy', 'cool_guy');
  assertHidden('t.me/coolguy99', 'coolguy99');
  assertHidden('tg id: neha_22', 'neha_22');
  assertHidden('Telegram pe aa jao, username neha.s', 'neha.s');
});

test('Snapchat ID sharing', () => {
  assertHidden('add me on snapchat: ankit.x', 'ankit.x');
  assertHidden('snap id ankit_7', 'ankit_7');
  assertHidden('my snapchat username is ankit2000', 'ankit2000');
});

test('other platforms', () => {
  for (const text of [
    'find me on facebook',
    'FB pe add karo',
    'ping me on discord',
    'skype call karein?',
    'twitter pe follow karo',
    'X (Twitter) handle',
    'message me on signal',
    'imo pe call karo',
    'messenger pe baat karte hai',
  ]) {
    assert.equal(moderateContactInfo(text).flagged, true, `not flagged: ${text}`);
  }
});

test('phone numbers with country codes and formats', () => {
  assertHidden('call me 9876543210', '9876543210');
  assertHidden('+91 98765 43210', '98765');
  assertHidden('+91-98765-43210', '43210');
  assertHidden('919876543210', '9876543210');
  assertHidden('09876543210', '9876543210');
  assertHidden('(+91) 987 654 3210', '654');
  assertHidden('my no is 98 76 54 32 10', '32 10');
  assertHidden('9 8 7 6 5 4 3 2 1 0', '5 4 3');
  assertHidden('+1 415 555 2671', '555');
  assertHidden('mob9876543210', '9876543210');
  assertHidden('nine eight seven six five four three two one zero', 'four three');
  assertHidden('नौ आठ सात छह पांच चार तीन दो एक शून्य', 'चार तीन');
  assertHidden('९८७६५४३२१०', '९८७६५४३२१०');
  assertHidden('９８７６５４３２１０', '９８７６５４３２１０');
  assert.ok(moderateContactInfo('call 9876543210').categories.includes(CATEGORY.PHONE));
});

test('emails', () => {
  assertHidden('mail me at praveen.k@gmail.com', 'gmail');
  assertHidden('praveen at gmail dot com', 'gmail');
  assertHidden('praveen (at) gmail (dot) com', 'gmail');
  assertHidden('PRAVEEN @ GMAIL . COM', 'GMAIL');
});

test('spaced and dotted words', () => {
  for (const text of [
    'I n s t a g r a m',
    'i.n.s.t.a.g.r.a.m',
    'insta gram',
    'w h a t s a p p',
    'whats app',
    'what-s-app',
    't_e_l_e_g_r_a_m',
    'tele gram',
    'face book',
    'snap chat',
  ]) {
    const res = moderateContactInfo(text);
    assert.equal(res.flagged, true, `not flagged: ${text}`);
    assert.ok(!/[a-z]{3}/i.test(res.masked), `partially leaked: ${res.masked}`);
  }
});

test('unicode and special-character bypasses', () => {
  for (const text of [
    'INSTAGRAM',
    'inst@gram',
    '1nstagram',
    'te1egram',
    'wh4tsapp',
    'whaaatsappp',
    'ｗｈａｔｓａｐｐ',
    '𝔀𝓱𝓪𝓽𝓼𝓪𝓹𝓹',
    'ⓦⓗⓐⓣⓢⓐⓟⓟ',
    'wһatsapp', // Cyrillic һ
    'іnstagram', // Cyrillic і
    'whats\u200Bapp',
    'i🔥n🔥s🔥t🔥a🔥g🔥r🔥a🔥m',
    'wátsápp',
    'telegrám',
  ]) {
    assert.equal(moderateContactInfo(text).flagged, true, `not flagged: ${text}`);
  }
});

test('masks only the platform word, not the next word', () => {
  assert.equal(mask('whatsapp pe aa jao'), `${stars('whatsapp')} pe aa jao`);
  assert.equal(mask('insta pe mil'), `${stars('insta')} pe mil`);
});

test('masking keeps message structure and is idempotent', () => {
  const text = 'Hi!\nMy insta is @riya_k 🙂 and number 9876543210.';
  const once = mask(text);
  assert.equal(Array.from(once).length, Array.from(text).length);
  assert.ok(once.includes('\n'));
  assert.ok(once.startsWith('Hi!\nMy '));
  assert.ok(once.endsWith('.'));
  assert.equal(mask(once), once);
});

test('normal conversations stay unchanged', () => {
  for (const text of [
    'Hi, how are you?',
    'Kal milte hai cafe pe, 5 baje',
    'The wifi signal is weak here',
    'Oh snap, I forgot my wallet',
    'imo the movie was great',
    'Let me install the app',
    'That was an instant hit',
    'I will be there in 10 minutes',
    'mujhe coffee pasand hai',
    'Do you like music?',
    'Was it fun?',
    'Can you send me the photo?',
    'Meet me at the mall',
    'She is a big fan of messenger bags',
    'I sent the documents by email yesterday',
    'Thanks, see you at 7:30 pm',
    'box.com has the files',
    'aap kaise ho? sab theek?',
    'Ek do teen char, chalo chalte hai',
    '2 x 3 = 6',
    'Telephone par baat karte hai',
    'Is that the face? Book now',
    'aaj network signal nahi aa raha',
    'tumhara snap mast tha',
    'meri id card wali photo dekh lo',
  ]) {
    assertUnchanged(text);
  }
});

test('booking IDs, prices, dates and OTPs stay unchanged', () => {
  for (const text of [
    'Booking ID 3f2a9c1e-8b7d-4e5f-9a1b-2c3d4e5f6a7b',
    'Paid ₹9999 for the booking',
    'Amount Rs. 1,50,000 transferred',
    'Total is 7500 rupees',
    'Your OTP is 482913',
    'Meeting on 12/10/2026 at 4 pm',
    'Date: 2026-10-12',
    'Booking #9876543210 confirmed',
    'Order id 9876543210 is pending',
    'Transaction ref 7012345678 successful',
    'Code 123456 enter karo',
    'Price ₹ 999 only',
    'Call me on 12-10-2026 evening',
    'BK9876543210',
  ]) {
    assertUnchanged(text);
  }
});

test('configuration toggles', () => {
  assert.equal(mask('instagram 9876543210', { enabled: false }), 'instagram 9876543210');
  assert.equal(mask('call 9876543210', { maskPhones: false }), 'call 9876543210');
  assert.equal(mask('find me on instagram', { maskPlatforms: false }), 'find me on instagram');
  assert.equal(mask('mail a@b.com', { maskEmails: false }), 'mail a@b.com');
  assert.equal(mask('meet on zoomcall', { extraWords: ['zoomcall'] }), `meet on ${stars('zoomcall')}`);
  const custom = moderateContactInfo('meet on z o o m c a l l', { extraWords: ['zoomcall'] });
  assert.ok(custom.categories.includes(CATEGORY.CUSTOM));
});

test('result never contains original content in metadata', () => {
  const res = moderateContactInfo('My WhatsApp number is 9876543210');
  const serialized = JSON.stringify({ categories: res.categories, matches: res.matches });
  assert.ok(!serialized.includes('9876543210'));
  assert.ok(!/whatsapp/i.test(serialized.replace(/social_platform/g, '')));
});
