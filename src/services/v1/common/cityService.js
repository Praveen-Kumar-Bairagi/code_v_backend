const { City } = require('../../../models');

async function listActiveCities() {
  return City.findAll({
    where: { isActive: true },
    attributes: ['id', 'name', 'state', 'sortOrder'],
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
  });
}

module.exports = {
  listActiveCities,
};
