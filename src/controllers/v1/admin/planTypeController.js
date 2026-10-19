const planTypeService = require('../../../services/v1/common/planTypeService');

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    const data = await fn(req);
    res.status(status).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list: handle(() => planTypeService.listPlanTypes({ includeInactive: true })),
  create: handle((req) => planTypeService.createPlanType(req.body), 201),
  update: handle((req) => planTypeService.updatePlanType(req.params.id, req.body)),
  remove: handle((req) => planTypeService.removePlanType(req.params.id)),
};
