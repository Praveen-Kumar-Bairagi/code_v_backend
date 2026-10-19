'use strict';

const { moderateChatMessage, normalizeEngineConfig } = require('./chatModerationEngine');

/**
 * Process-wide copy of the admin moderation settings so synchronous callers
 * (model hooks, response formatters) can mask without hitting the database.
 * Refreshed by chatModerationService.
 */
let activeConfig = normalizeEngineConfig();

function getActiveModerationConfig() {
  return activeConfig;
}

function setActiveModerationConfig(config) {
  activeConfig = normalizeEngineConfig(config);
  return activeConfig;
}

function maskChatText(text) {
  return moderateChatMessage(text, activeConfig).masked;
}

module.exports = {
  getActiveModerationConfig,
  setActiveModerationConfig,
  maskChatText,
};
