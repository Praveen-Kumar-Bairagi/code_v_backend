'use strict';

const { sequelize, LegalDocument } = require('../src/models');

(async () => {
  const [n] = await LegalDocument.update(
    { isActive: false },
    {
      where: {
        slug: [
          'terms',
          'privacy',
          'cancellation',
          'refund-policy',
          'code-of-conduct',
          'safety',
        ],
      },
    }
  );
  console.log('deactivated aliases:', n);
  await sequelize.close();
})().catch(async (err) => {
  console.error(err);
  await sequelize.close();
  process.exit(1);
});
