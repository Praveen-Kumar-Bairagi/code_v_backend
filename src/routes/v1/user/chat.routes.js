const express = require('express');
const chatController = require('../../../controllers/v1/user/chatController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

// Auth per route — avoid blanket middleware on `/` catch-all mount
router.put('/chat/e2ee/device-key', authenticateUser, chatController.registerDeviceKey);
router.get('/chat/moderation-config', authenticateUser, chatController.moderationConfig);
router.get('/conversations', authenticateUser, chatController.listConversations);
router.get('/conversations/unread-total', authenticateUser, chatController.unreadTotal);
router.get('/conversations/games', authenticateUser, chatController.listGames);
router.get('/conversations/themes', authenticateUser, chatController.listThemes);
router.put('/conversations/:id/theme', authenticateUser, chatController.setTheme);
router.put('/conversations/:id/favorite', authenticateUser, chatController.setFavorite);
router.put('/conversations/:id/mute', authenticateUser, chatController.setMuted);
router.put('/conversations/:id/archive', authenticateUser, chatController.setArchived);
router.post('/conversations/:id/games', authenticateUser, chatController.playGame);
router.get('/conversations/:id', authenticateUser, chatController.getConversation);
router.get('/conversations/:id/keys', authenticateUser, chatController.getConversationKeys);
router.get('/conversations/:id/messages', authenticateUser, chatController.listMessages);
router.post('/conversations/:id/messages', authenticateUser, chatController.sendMessage);
router.post('/conversations/:id/read', authenticateUser, chatController.markRead);
router.post('/conversations/with/:userId', authenticateUser, chatController.getOrCreateWithUser);

module.exports = router;
