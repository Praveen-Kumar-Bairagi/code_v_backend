const peopleService = require('../../../services/v1/user/peopleService');
const { paginateList } = require('../../../utils/paginate');

async function listPeople(req, res, next) {
  try {
    const {
      cityId,
      creatorsOnly,
      full,
      latitude,
      longitude,
      lat,
      lng,
      search,
      discover,
      gender,
      minAge,
      maxAge,
      radiusKm,
      photosOnly,
      otherCities,
      limit,
      offset,
      sort,
    } = req.query;
    const data = await peopleService.listPeople(req.userId, {
      cityId,
      creatorsOnly,
      search,
      discover,
      gender,
      minAge,
      maxAge,
      radiusKm,
      photosOnly,
      otherCities,
      sort: ['name', 'city', 'distance'].includes(sort) ? sort : undefined,
      full: full === '1' || full === 'true',
      latitude: latitude ?? lat,
      longitude: longitude ?? lng,
    });
    res.json({ success: true, data: paginateList(data, { limit, offset }) });
  } catch (err) {
    next(err);
  }
}

async function getPerson(req, res, next) {
  try {
    const { latitude, longitude, lat, lng } = req.query;
    const data = await peopleService.getPersonById(req.userId, req.params.id, {
      latitude: latitude ?? lat,
      longitude: longitude ?? lng,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPeople,
  getPerson,
};
