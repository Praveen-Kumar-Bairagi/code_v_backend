const coinService = require('../../../services/v1/user/coinService');

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    const data = await fn(req);
    res.status(status).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  wallet: handle((req) => coinService.getWallet(req.userId, req.query)),
  packs: handle(() => coinService.listPacks()),

  adminSettings: handle(() => coinService.getCoinSettings()),
  adminUpdateSettings: handle((req) => coinService.updateCoinSettings(req.body || {})),
  adminListPacks: handle(() => coinService.listPacks({ activeOnly: false })),
  adminCreatePack: handle((req) => coinService.createPack(req.body || {}), 201),
  adminUpdatePack: handle((req) => coinService.updatePack(req.params.id, req.body || {})),
  adminDeletePack: handle((req) => coinService.deletePack(req.params.id)),
};
