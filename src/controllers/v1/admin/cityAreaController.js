const cityAreaService = require('../../../services/v1/common/cityAreaService');

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    const data = await fn(req);
    res.status(status).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list: handle((req) => cityAreaService.listAreas(req.query)),
  create: handle((req) => cityAreaService.createArea(req.body), 201),
  update: handle((req) => cityAreaService.updateArea(req.params.id, req.body)),
  remove: handle((req) => cityAreaService.removeArea(req.params.id)),
  bulkStatus: handle((req) => cityAreaService.bulkSetAreaStatus(req.body)),
  lookup: handle((req) => cityAreaService.lookupAreaLocation(req.body)),
};
