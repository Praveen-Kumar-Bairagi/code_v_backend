const env = require('../config/env');
const AppError = require('../utils/AppError');
const normalizeMobile = require('../utils/normalizeMobile');

const REQUEST_TIMEOUT_MS = 15000;

/** OTP API only needs the auth key; sender / DLT ids are handled by the gateway's OTP config. */
function otpConfigProblems() {
  return env.sms.authKey ? [] : ['SMS_AUTH_KEY is empty'];
}

/** DLT requirements for free-text SMS via `sendSms`. */
function dltConfigProblems() {
  const problems = [...otpConfigProblems()];
  if (!/^[A-Za-z]{6}$/.test(env.sms.senderId)) problems.push('SMS_SENDER_ID must be exactly 6 letters');
  if (!env.sms.peId) problems.push('SMS_PE_ID is empty');
  return problems;
}

if (env.sms.enabled && otpConfigProblems().length) {
  console.warn(
    `[sms] SMS_ENABLED=true but OTP SMS is OFF until fixed: ${otpConfigProblems().join('; ')}`
  );
}

/** Missing config keeps OTP SMS off so logins fall back to the master OTP instead of failing. */
function isEnabled() {
  return env.sms.enabled && otpConfigProblems().length === 0;
}

/** Fills `{key}` placeholders; the result must match the DLT template text exactly. */
function fillTemplate(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (match, key) =>
    values[key] != null ? String(values[key]) : match
  );
}

function parseBody(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function isSuccess(httpOk, body) {
  if (!httpOk) return false;
  const status = String(body?.status ?? '').toLowerCase();
  if (['error', 'failed', 'fail', 'false'].includes(status)) return false;
  if (['success', 'ok', 'true', '200'].includes(status)) return true;
  return !!body?.request_id;
}

function gatewayMessage(body) {
  if (!body) return null;
  const parts = [body.message, ...(Array.isArray(body.errors) ? body.errors.map((e) => e?.message) : [])];
  return parts.filter(Boolean).join(' · ').slice(0, 500) || (body.raw ? String(body.raw).slice(0, 500) : null);
}

/** Never throws — a logging failure must not block sending. */
async function writeLog(entry) {
  try {
    const { SmsLog } = require('../models');
    await SmsLog.create(entry);
  } catch (err) {
    console.warn('[sms] log write failed', err?.message || err);
  }
}

/**
 * POSTs a form to the gateway (it ignores the authkey header), logs the attempt and returns `{ requestId }`.
 * @param {object} log `{ kind, purpose, mobile, templateId, message }` for the sms_logs row
 */
async function postToGateway(url, fields, label, log) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  let res;
  let body;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ authkey: env.sms.authKey, ...fields }).toString(),
      signal: controller.signal,
    });
    body = parseBody(await res.text());
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'Gateway timed out' : `Network error: ${err?.message || err}`;
    console.warn(`[sms] ${label} request failed`, reason);
    await writeLog({
      ...log,
      status: 'failed',
      responseMessage: reason.slice(0, 500),
      durationMs: Date.now() - startedAt,
    });
    throw new AppError('Could not send SMS. Please try again.', 502);
  } finally {
    clearTimeout(timer);
  }

  const ok = isSuccess(res.ok, body);
  const requestId = body?.request_id ?? body?.data?.request_id ?? null;
  await writeLog({
    ...log,
    status: ok ? 'sent' : 'failed',
    httpStatus: res.status,
    requestId: requestId ? String(requestId).slice(0, 120) : null,
    responseMessage: gatewayMessage(body),
    response: body,
    durationMs: Date.now() - startedAt,
  });

  if (!ok) {
    console.warn(`[sms] ${label} rejected`, res.status, JSON.stringify(body).slice(0, 300));
    throw new AppError('Could not send SMS. Please try again.', 502);
  }
  return { requestId };
}

/**
 * Sends a free-text DLT SMS (alerts etc.).
 * @param {object} opts
 * @param {string|string[]} opts.to 10-digit mobile number(s)
 * @param {string} opts.message Exact DLT-approved text
 * @param {string} opts.templateId DLT template id for this message
 */
async function sendSms({ to, message, templateId, purpose }) {
  const problems = env.sms.enabled ? dltConfigProblems() : ['SMS_ENABLED is false'];
  if (problems.length) {
    throw new AppError(`SMS is not configured: ${problems.join('; ')}`, 503);
  }
  const mobiles = (Array.isArray(to) ? to : [to]).map((m) => normalizeMobile(m)).join(',');
  if (!mobiles) throw new AppError('Mobile number is required', 400);
  if (!message) throw new AppError('SMS message is required', 400);
  if (!templateId) throw new AppError('DLT template id is required', 400);

  return postToGateway(
    env.sms.apiUrl,
    {
      mobiles,
      message,
      sender: env.sms.senderId,
      route: env.sms.route,
      template_id: templateId,
      pe_id: env.sms.peId,
      unicode: /[^\x00-\x7F]/.test(message) ? '1' : '0',
    },
    'sendMsg',
    { kind: 'sms', purpose: purpose || null, mobile: mobiles.slice(0, 20), templateId, message }
  );
}

/** OTP for login / signup / account actions via the gateway's OTP API. */
async function sendOtpSms(mobileNumber, otp, purpose = 'login') {
  if (!isEnabled()) {
    throw new AppError('SMS is not configured', 503);
  }
  const mobile = normalizeMobile(mobileNumber);
  if (!mobile) throw new AppError('Mobile number is required', 400);
  return postToGateway(
    env.sms.otpApiUrl,
    {
      mobile,
      otp: String(otp),
      // Dashboard "SMS Templates" id; without it the gateway uses its default OTP template.
      ...(env.sms.otpTemplateId ? { template_id: env.sms.otpTemplateId } : {}),
    },
    'sendOtp',
    { kind: 'otp', purpose, mobile, templateId: env.sms.otpTemplateId || null, message: null }
  );
}

/** Gateway credit balance for the admin dashboard (read-only). */
async function getBalance() {
  const base = {
    configured: !!env.sms.authKey,
    enabled: isEnabled(),
    problems: env.sms.enabled ? otpConfigProblems() : [],
    lowBalanceAt: env.sms.lowBalance,
    checkedAt: new Date().toISOString(),
  };
  if (!env.sms.authKey) {
    return { ...base, balance: null, currency: null, error: 'SMS_AUTH_KEY is not set' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // The gateway ignores the authkey header; it must be sent as a form field.
    const res = await fetch(env.sms.balanceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ authkey: env.sms.authKey }).toString(),
      signal: controller.signal,
    });
    const body = parseBody(await res.text());
    const balance = Number(body?.data?.balance);
    if (!res.ok || String(body?.status).toLowerCase() !== 'success' || !Number.isFinite(balance)) {
      const reason =
        res.status === 401
          ? 'Invalid SMS auth key'
          : res.status === 403
            ? 'API key disabled or server IP not whitelisted'
            : body?.message || `Gateway returned ${res.status}`;
      console.warn('[sms] balance failed', res.status, JSON.stringify(body).slice(0, 300));
      return { ...base, balance: null, currency: null, error: reason };
    }
    return {
      ...base,
      balance,
      currency: body.data.currency || 'INR',
      low: balance < env.sms.lowBalance,
      error: null,
    };
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'SMS gateway timed out' : 'Could not reach SMS gateway';
    console.warn('[sms] balance failed', err?.message || err);
    return { ...base, balance: null, currency: null, error: reason };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  isEnabled,
  otpConfigProblems,
  dltConfigProblems,
  fillTemplate,
  sendSms,
  sendOtpSms,
  getBalance,
};
