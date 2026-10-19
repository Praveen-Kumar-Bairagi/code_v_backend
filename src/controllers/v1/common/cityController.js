const cityService = require('../../../services/v1/common/cityService');
const cityAreaService = require('../../../services/v1/common/cityAreaService');

async function listActive(req, res, next) {
  try {
    const data = await cityService.listActiveCities();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listAreas(req, res, next) {
  try {
    const data = await cityAreaService.listActiveAreasForCity(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function searchAreas(req, res, next) {
  try {
    const data = await cityAreaService.searchActiveAreas(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listActive,
  listAreas,
  searchAreas,
};
