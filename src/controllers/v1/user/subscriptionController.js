'use strict';

const AppError = require('../../../utils/AppError');
const subscriptionService = require('../../../services/v1/user/subscriptionService');
const bookingEntitlementService = require('../../../services/v1/user/bookingEntitlementService');

async function listPublicPlans(req, res, next) {
  try {
    const data = await subscriptionService.listPublicPlans();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listPlansAdmin(req, res, next) {
  try {
    const items = await subscriptionService.listPlans({
      activeOnly: req.query.activeOnly === 'true',
    });
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
}

async function createPlan(req, res, next) {
  try {
    const data = await subscriptionService.createPlan(req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updatePlan(req, res, next) {
  try {
    const data = await subscriptionService.updatePlan(req.params.id, req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listPurchases(req, res, next) {
  try {
    const data = await subscriptionService.listPurchases({
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listPlansUser(req, res, next) {
  try {
    const { plans } = await subscriptionService.listPublicPlans();
    res.json({ success: true, data: { items: plans } });
  } catch (err) {
    next(err);
  }
}

async function getStatus(req, res, next) {
  try {
    const [status, credits] = await Promise.all([
      subscriptionService.getStatus(req.userId),
      bookingEntitlementService.getFreeCredits(req.userId),
    ]);
    res.json({ success: true, data: { ...status, ...credits } });
  } catch (err) {
    next(err);
  }
}

async function purchase(req, res, next) {
  try {
    const planId = req.body?.planId;
    if (planId === undefined || planId === null || String(planId).trim() === '') {
      throw new AppError('planId is required', 400);
    }
    const data = await subscriptionService.purchasePlan(req.userId, planId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPublicPlans,
  listPlansAdmin,
  createPlan,
  updatePlan,
  listPurchases,
  listPlansUser,
  getStatus,
  purchase,
};
