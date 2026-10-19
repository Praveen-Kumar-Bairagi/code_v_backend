const planService = require('../../../services/v1/user/planService');
const { paginateList } = require('../../../utils/paginate');

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    const data = await fn(req);
    res.status(status).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  nearby: handle(async (req) =>
    paginateList(await planService.listNearbyPlans(req.userId, req.query), req.query)
  ),
  mine: handle((req) => planService.getMyPlan(req.userId)),
  create: handle((req) => planService.createPlan(req.userId, req.body), 201),
  cancel: handle((req) => planService.cancelPlan(req.userId, req.params.id)),
  respond: handle((req) => planService.respondToPlan(req.userId, req.params.id, req.body?.status)),
};
