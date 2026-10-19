'use strict';

const paymentService = require('../../../services/v1/user/paymentService');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function page(title, bodyHtml, headExtra = '') {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${headExtra}
<style>
  body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F8FAFF;color:#0D1B2A;
       display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{background:#fff;border:1px solid #E6EAF2;border-radius:20px;padding:28px 24px;max-width:360px;
        width:calc(100% - 40px);text-align:center;box-shadow:0 4px 12px rgba(99,102,241,.12)}
  h1{font-size:20px;margin:8px 0 6px} p{color:#5B6577;font-size:14px;line-height:20px;margin:0 0 18px}
  .amt{font-size:32px;font-weight:700;margin:6px 0 4px}
  button,a.btn{display:block;width:100%;border:0;border-radius:999px;padding:15px;font-size:16px;font-weight:700;
        color:#fff;background:linear-gradient(135deg,#8B5CF6,#6366F1,#06B6D4);cursor:pointer;text-decoration:none}
  .icon{font-size:44px}
  button.ghost{background:#fff;color:#DC2626;border:1.5px solid #FCA5A5}
  .test-badge{display:inline-block;background:#FEF3C7;color:#B45309;border:1px solid #FCD34D;border-radius:999px;
        font-size:12px;font-weight:700;padding:4px 12px;margin-bottom:6px}
  .note{font-size:12px;margin:14px 0 0}
</style></head><body><div class="card">${bodyHtml}</div></body></html>`;
}

async function createCoinPackOrder(req, res, next) {
  try {
    const data = await paymentService.createCoinPackOrder(req.userId, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createSubscriptionOrder(req, res, next) {
  try {
    const data = await paymentService.createSubscriptionOrder(req.userId, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createBookingOrder(req, res, next) {
  try {
    const data = await paymentService.createBookingOrder(req.userId, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createWalletTopupOrder(req, res, next) {
  try {
    const data = await paymentService.createWalletTopupOrder(req.userId, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const data = await paymentService.verifyCheckout(req.userId, req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const data = await paymentService.getOrder(req.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /payments/checkout/:id — hosted Razorpay Checkout (opened in in-app browser). */
async function checkoutPage(req, res) {
  try {
    const { order, keyId, brandName, callbackUrl, testMode } = await paymentService.getCheckoutData(
      req.params.id
    );
    if (order.status === 'paid') {
      const back = paymentService.buildReturnUrl(order, 'success');
      res.send(
        page(
          'Already paid',
          `<div class="icon">✅</div><h1>Already paid</h1><p>This payment is complete.</p>${
            back ? `<a class="btn" href="${escapeHtml(back)}">Back to app</a>` : ''
          }`
        )
      );
      return;
    }

    if (order.status === 'failed') {
      const back = paymentService.buildReturnUrl(order, 'failed');
      res.send(
        page(
          'Payment failed',
          `<div class="icon">❌</div><h1>Payment failed</h1><p>${escapeHtml(
            order.failureReason || 'This payment was not completed.'
          )}</p>${back ? `<a class="btn" href="${escapeHtml(back)}">Back to app</a>` : ''}`
        )
      );
      return;
    }

    if (testMode) {
      const hidden = (outcome) =>
        `<input type="hidden" name="razorpay_order_id" value="${escapeHtml(order.razorpayOrderId)}" />
         <input type="hidden" name="test_outcome" value="${outcome}" />`;
      res.send(
        page(
          `Test payment ₹${order.amount}`,
          `<div class="test-badge">TEST MODE · no real money</div>
           <div class="icon">🧪</div>
           <h1>${escapeHtml(brandName)}</h1>
           <div class="amt">₹${escapeHtml(order.amount)}</div>
           <p>${escapeHtml(order.meta?.description || 'Payment')}</p>
           <form method="post" action="${escapeHtml(callbackUrl)}">${hidden('success')}
             <button type="submit">Pay ₹${escapeHtml(order.amount)} (test success)</button>
           </form>
           <form method="post" action="${escapeHtml(callbackUrl)}" style="margin-top:10px">${hidden('failed')}
             <button type="submit" class="ghost">Simulate failure</button>
           </form>
           <p class="note">Razorpay keys are not configured, so this payment is simulated.</p>`
        )
      );
      return;
    }

    const user = order.user || {};
    const options = {
      key: keyId,
      order_id: order.razorpayOrderId,
      amount: order.amount * 100,
      currency: order.currency,
      name: brandName,
      description: order.meta?.description || 'Payment',
      callback_url: callbackUrl,
      redirect: true,
      prefill: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        contact: user.mobileNumber ? `+91${user.mobileNumber}` : undefined,
        email: user.email || undefined,
      },
      theme: { color: '#7C5CFC' },
    };

    res.send(
      page(
        `Pay ₹${order.amount}`,
        `<div class="icon">🔒</div>
         <h1>${escapeHtml(brandName)}</h1>
         <div class="amt">₹${escapeHtml(order.amount)}</div>
         <p>${escapeHtml(options.description)}</p>
         <button id="pay">Pay securely</button>
         <script>
           var options = ${JSON.stringify(options).replace(/</g, '\\u003c')};
           function openCheckout(){ new Razorpay(options).open(); }
           document.getElementById('pay').onclick = openCheckout;
           window.addEventListener('load', openCheckout);
         </script>`,
        '<script src="https://checkout.razorpay.com/v1/checkout.js"></script>'
      )
    );
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .send(page('Payment', `<div class="icon">⚠️</div><h1>Payment unavailable</h1><p>${escapeHtml(err.message)}</p>`));
  }
}

/** POST /payments/razorpay/callback — Razorpay redirect after checkout; updates DB then returns to app. */
async function callback(req, res) {
  let order = null;
  let status = 'failed';
  let message = 'Payment was not completed.';
  try {
    order = await paymentService.handleCallback(req.body || {});
    if (order?.status === 'paid') {
      status = 'success';
      message = 'Payment successful.';
    } else if (order?.failureReason) {
      message = order.failureReason;
    }
  } catch (err) {
    message = err.message || message;
  }

  const back = order ? paymentService.buildReturnUrl(order, status) : null;
  const ok = status === 'success';
  res.send(
    page(
      ok ? 'Payment successful' : 'Payment failed',
      `<div class="icon">${ok ? '✅' : '❌'}</div>
       <h1>${ok ? 'Payment successful' : 'Payment failed'}</h1>
       <p>${escapeHtml(message)}</p>
       ${back ? `<a class="btn" href="${escapeHtml(back)}">Back to app</a>
       <script>setTimeout(function(){ window.location.href = ${JSON.stringify(back)}; }, 800);</script>` : '<p>You can close this window.</p>'}`
    )
  );
}

/** POST /payments/razorpay/webhook — configure this URL in Razorpay Dashboard → Webhooks. */
async function webhook(req, res) {
  try {
    const data = await paymentService.handleWebhook(
      req.rawBody,
      req.get('x-razorpay-signature')
    );
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode !== 400) console.error('Razorpay webhook error', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

module.exports = {
  createCoinPackOrder,
  createSubscriptionOrder,
  createBookingOrder,
  createWalletTopupOrder,
  verify,
  getOrder,
  checkoutPage,
  callback,
  webhook,
};
