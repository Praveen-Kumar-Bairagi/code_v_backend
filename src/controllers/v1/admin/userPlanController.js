const userPlanService = require('../../../services/v1/admin/userPlanService');

async function list(req, res, next) {
  try {
    const { status, planId, tier, search, page, limit } = req.query;
    const data = await userPlanService.listUserPlans({ status, planId, tier, search, page, limit });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
