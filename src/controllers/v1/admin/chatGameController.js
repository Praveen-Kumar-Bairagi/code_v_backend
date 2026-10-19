const chatGameConfigService = require('../../../services/v1/common/chatGameConfigService');

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    const data = await fn(req);
    res.status(status).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list: handle(() => chatGameConfigService.adminList()),
  update: handle((req) => chatGameConfigService.adminUpdate(req.params.id, req.body)),
};
