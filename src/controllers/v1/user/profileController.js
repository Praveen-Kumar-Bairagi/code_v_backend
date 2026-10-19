const profileService = require('../../../services/v1/user/profileService');
const settingsService = require('../../../services/v1/user/settingsService');

async function getSettings(req, res, next) {
  try {
    const data = await settingsService.getSettings(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const data = await settingsService.updateSettings(req.userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const data = await profileService.getProfile(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const data = await profileService.updateProfile(req.userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function replacePhotos(req, res, next) {
  try {
    const files = req.files || [];
    const data = await profileService.replacePhotos(req.userId, files);
    res.json({ success: true, message: 'Photos uploaded', data });
  } catch (err) {
    next(err);
  }
}

async function uploadPhotoSlot(req, res, next) {
  try {
    const index = req.body?.index ?? req.query?.index;
    const data = await profileService.uploadPhotoSlot(req.userId, req.file, index);
    console.log('[PHOTO-DEBUG] saved', {
      userId: req.userId,
      index,
      photos: data?.photos,
    });
    res.json({ success: true, message: 'Photo uploaded', data });
  } catch (err) {
    console.error('[PHOTO-DEBUG] upload failed', {
      userId: req.userId,
      index: req.body?.index,
      status: err.statusCode || err.status,
      message: err.message,
      stack: err.stack,
    });
    next(err);
  }
}

async function clearPhotoSlot(req, res, next) {
  try {
    const data = await profileService.clearPhotoSlot(req.userId, req.params.index);
    res.json({ success: true, message: 'Photo removed', data });
  } catch (err) {
    next(err);
  }
}

async function submitBio(req, res, next) {
  try {
    const data = await profileService.submitBio(req.userId, req.body?.aboutMe ?? req.body?.bio);
    res.json({ success: true, message: 'Bio submitted for approval', data });
  } catch (err) {
    next(err);
  }
}

async function updateOnboarding(req, res, next) {
  try {
    const data = await profileService.updateOnboarding(req.userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateCurrentLocation(req, res, next) {
  try {
    const data = await profileService.updateCurrentLocation(req.userId, req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSettings,
  updateSettings,
  getProfile,
  updateProfile,
  submitBio,
  updateOnboarding,
  replacePhotos,
  uploadPhotoSlot,
  clearPhotoSlot,
  updateCurrentLocation,
};
