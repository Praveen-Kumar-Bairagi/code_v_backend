'use strict';

const { encryptText, decryptText, isEncrypted } = require('../utils/messageCrypto');

const BATCH = 500;

async function convert(queryInterface, transform, needsChange) {
  const { sequelize } = queryInterface;
  let lastId = '00000000-0000-0000-0000-000000000000';
  for (;;) {
    const [rows] = await sequelize.query(
      `SELECT id, body, "originalBody" FROM messages WHERE id > :lastId ORDER BY id LIMIT ${BATCH}`,
      { replacements: { lastId } }
    );
    if (!rows.length) break;
    for (const row of rows) {
      if (!needsChange(row.body) && !(row.originalBody && needsChange(row.originalBody))) continue;
      await sequelize.query(
        'UPDATE messages SET body = :body, "originalBody" = :originalBody WHERE id = :id',
        {
          replacements: {
            id: row.id,
            body: needsChange(row.body) ? transform(row.body) : row.body,
            originalBody:
              row.originalBody && needsChange(row.originalBody)
                ? transform(row.originalBody)
                : row.originalBody,
          },
        }
      );
    }
    lastId = rows[rows.length - 1].id;
  }
}

/** Encrypts existing chat messages at rest and indexes them for paged loading. */
module.exports = {
  async up(queryInterface) {
    await convert(queryInterface, encryptText, (v) => typeof v === 'string' && !isEncrypted(v));
    await queryInterface.addIndex('messages', ['conversationId', 'createdAt'], {
      name: 'messages_conversation_created_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('messages', 'messages_conversation_created_idx');
    await convert(queryInterface, decryptText, isEncrypted);
  },
};
