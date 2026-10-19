'use strict';

const { Op } = require('sequelize');
const { Message } = require('../../../models');
const AppError = require('../../../utils/AppError');
const { TIER_LABELS, tierRank } = require('../../../content/chatGames');
const { listActiveGames } = require('../common/chatGameConfigService');
const subscriptionService = require('./subscriptionService');
const chatService = require('./chatService');

async function getUserTier(userId) {
  const status = await subscriptionService.getStatus(userId);
  return status.isActive ? status.tier || 'chat' : null;
}

async function getTierPrices() {
  const plans = await subscriptionService.listPlans({ activeOnly: true });
  const prices = {};
  for (const plan of plans) {
    const tier = plan.tier || 'chat';
    if (prices[tier] == null || plan.priceRupees < prices[tier]) {
      prices[tier] = plan.priceRupees;
    }
  }
  return prices;
}

const SESSION_HOURS = 2;

/** Game ids the peer started in this conversation recently — the user may take turns in them. */
async function partnerSessionGameIds(userId, conversationId) {
  if (!conversationId) return new Set();
  const conversation = await chatService.assertConversationParticipant(conversationId, userId);
  const rows = await Message.findAll({
    where: {
      conversationId,
      senderId: chatService.peerIdOf(conversation, userId),
      kind: 'game',
      createdAt: { [Op.gt]: new Date(Date.now() - SESSION_HOURS * 60 * 60 * 1000) },
    },
    attributes: ['meta'],
  });
  return new Set(rows.map((r) => r.meta?.gameId).filter(Boolean));
}

async function listGames(userId, conversationId = null) {
  const [tier, prices, partnerGames, games] = await Promise.all([
    getUserTier(userId),
    getTierPrices(),
    partnerSessionGameIds(userId, conversationId),
    listActiveGames(),
  ]);
  const rank = tier ? tierRank(tier) : -1;
  return {
    tier,
    games: games.map((g) => {
      const ownAccess = rank >= tierRank(g.tier);
      const viaPartner = !ownAccess && partnerGames.has(g.id);
      return {
      id: g.id,
      title: g.title,
      emoji: g.emoji,
      description: g.description,
      type: g.type,
      requiredTier: g.tier,
      requiredTierLabel: TIER_LABELS[g.tier],
      requiredTierPrice: prices[g.tier] ?? null,
      locked: !ownAccess && !viaPartner,
      viaPartner,
      };
    }),
  };
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function playGame(userId, conversationId, { gameId, pick } = {}) {
  const game = (await listActiveGames()).find((g) => g.id === gameId);
  if (!game) throw new AppError('This game is not available right now', 404);

  const tier = await getUserTier(userId);
  const ownAccess = !!tier && tierRank(tier) >= tierRank(game.tier);
  if (!ownAccess && !(await partnerSessionGameIds(userId, conversationId)).has(game.id)) {
    const err = new AppError(
      `${game.title} is part of the ${TIER_LABELS[game.tier]} plan. Upgrade to play.`,
      402
    );
    err.code = 'GAME_LOCKED';
    throw err;
  }

  let meta;
  let body;
  if (game.type === 'truth_dare') {
    const side = pick === 'dare' ? 'dare' : 'truth';
    const prompt = pickRandom(side === 'dare' ? game.dares : game.truths);
    meta = { gameId: game.id, title: game.title, emoji: game.emoji, type: game.type, pick: side, prompt };
    body = `${game.emoji} ${game.title} · ${side === 'dare' ? 'Dare' : 'Truth'}: ${prompt}`;
  } else if (game.type === 'choice') {
    const options = pickRandom(game.prompts);
    meta = { gameId: game.id, title: game.title, emoji: game.emoji, type: game.type, options };
    body = `${game.emoji} ${game.title}: ${options[0]} or ${options[1]}?`;
  } else {
    const prompt = pickRandom(game.prompts);
    meta = { gameId: game.id, title: game.title, emoji: game.emoji, type: game.type, prompt };
    body = `${game.emoji} ${game.title}: ${prompt}`;
  }

  return chatService.sendGameMessage(userId, conversationId, { body, meta });
}

module.exports = { listGames, playGame };
