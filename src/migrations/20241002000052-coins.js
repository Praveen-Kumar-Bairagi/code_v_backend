'use strict';

/** Coins: balance per user, ledger, purchasable packs, and coins bundled with subscriptions. */

const { randomUUID } = require('crypto');

const SIGNUP_BONUS = 50;

const PACKS = [
  ['Starter', 50, 49, 'Enough for 5 plans'],
  ['Popular', 120, 99, 'Best for regular plans'],
  ['Value', 300, 199, 'Most coins per rupee'],
];

/** Coins credited with each subscription, by duration. */
function bonusForDuration(days) {
  if (days >= 300) return 2200;
  if (days >= 150) return 1000;
  return 150;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.describeTable('users');
    if (!users.coinBalance) {
      await queryInterface.addColumn('users', 'coinBalance', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    const plans = await queryInterface.describeTable('subscription_plans');
    if (!plans.bonusCoins) {
      await queryInterface.addColumn('subscription_plans', 'bonusCoins', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
      const [rows] = await queryInterface.sequelize.query(
        'SELECT id, "durationDays" FROM subscription_plans'
      );
      for (const row of rows) {
        await queryInterface.sequelize.query(
          'UPDATE subscription_plans SET "bonusCoins" = :coins WHERE id = :id',
          { replacements: { coins: bonusForDuration(row.durationDays), id: row.id } }
        );
      }
    }

    const timestamps = {
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    };

    await queryInterface.createTable('coin_packs', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(80), allowNull: false },
      coins: { type: Sequelize.INTEGER, allowNull: false },
      priceRupees: { type: Sequelize.INTEGER, allowNull: false },
      tagline: { type: Sequelize.STRING(160), allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });

    await queryInterface.createTable('coin_transactions', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.STRING(30), allowNull: false },
      /** Signed: positive = credit, negative = debit. */
      amount: { type: Sequelize.INTEGER, allowNull: false },
      balanceAfter: { type: Sequelize.INTEGER, allowNull: false },
      title: { type: Sequelize.STRING(160), allowNull: false },
      referenceId: { type: Sequelize.STRING(64), allowNull: true },
      idempotencyKey: { type: Sequelize.STRING(120), allowNull: true, unique: true },
      meta: { type: Sequelize.JSONB, allowNull: true },
      ...timestamps,
    });
    await queryInterface.addIndex('coin_transactions', ['userId', 'createdAt']);

    const now = new Date();
    await queryInterface.bulkInsert(
      'coin_packs',
      PACKS.map(([name, coins, priceRupees, tagline], i) => ({
        id: randomUUID(),
        name,
        coins,
        priceRupees,
        tagline,
        isActive: true,
        sortOrder: (i + 1) * 10,
        createdAt: now,
        updatedAt: now,
      }))
    );

    for (const [key, value] of [
      ['coins.planPostCost', '10'],
      ['coins.signupBonus', String(SIGNUP_BONUS)],
    ]) {
      await queryInterface.sequelize.query(
        `INSERT INTO platform_settings (key, value, "createdAt", "updatedAt")
         VALUES (:key, :value, NOW(), NOW()) ON CONFLICT (key) DO NOTHING`,
        { replacements: { key, value } }
      );
    }

    const [existing] = await queryInterface.sequelize.query('SELECT id FROM users');
    if (existing.length) {
      await queryInterface.sequelize.query(
        'UPDATE users SET "coinBalance" = "coinBalance" + :bonus',
        { replacements: { bonus: SIGNUP_BONUS } }
      );
      await queryInterface.bulkInsert(
        'coin_transactions',
        existing.map((u) => ({
          id: randomUUID(),
          userId: u.id,
          type: 'signup_bonus',
          amount: SIGNUP_BONUS,
          balanceAfter: SIGNUP_BONUS,
          title: 'Welcome bonus',
          referenceId: null,
          idempotencyKey: `signup_bonus:${u.id}`,
          meta: null,
          createdAt: now,
          updatedAt: now,
        }))
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('coin_transactions');
    await queryInterface.dropTable('coin_packs');
    await queryInterface.removeColumn('subscription_plans', 'bonusCoins');
    await queryInterface.removeColumn('users', 'coinBalance');
    await queryInterface.sequelize.query(
      `DELETE FROM platform_settings WHERE key IN ('coins.planPostCost', 'coins.signupBonus')`
    );
  },
};
