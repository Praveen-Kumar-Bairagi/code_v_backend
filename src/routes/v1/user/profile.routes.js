const express = require('express');
const profileController = require('../../../controllers/v1/user/profileController');
const { authenticateUser } = require('../../../middlewares/auth');
const upload = require('../../../middlewares/upload');
const { PROFILE_PHOTO_SLOTS } = require('../../../services/v1/user/profileService');

const router = express.Router();

router.use(authenticateUser);

router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);
router.patch('/', profileController.updateProfile);
router.get('/settings', profileController.getSettings);
router.patch('/settings', profileController.updateSettings);
router.post('/bio', profileController.submitBio);
router.patch('/onboarding', profileController.updateOnboarding);
router.put('/location', profileController.updateCurrentLocation);
router.patch('/location', profileController.updateCurrentLocation);

// Multipart gallery replace (field: photos) — same as old Compameet
router.put(
  '/photos',
  upload.array('photos', PROFILE_PHOTO_SLOTS),
  profileController.replacePhotos
);

// Single slot upload (field: photo, body.index)
router.post(
  '/photos/slot',
  (req, res, next) => {
    console.log('[PHOTO-DEBUG] auth ok, parsing multipart', { userId: req.userId });
    upload.single('photo')(req, res, (err) => {
      if (err) {
        console.error('[PHOTO-DEBUG] multer error', {
          userId: req.userId,
          name: err.name,
          code: err.code,
          field: err.field,
          message: err.message,
        });
        return next(err);
      }
      console.log('[PHOTO-DEBUG] multer ok', {
        userId: req.userId,
        body: req.body,
        file: req.file
          ? {
              field: req.file.fieldname,
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
              sizeKB: Math.round(req.file.size / 1024),
            }
          : null,
      });
      next();
    });
  },
  profileController.uploadPhotoSlot
);

router.delete('/photos/:index', profileController.clearPhotoSlot);

module.exports = router;
