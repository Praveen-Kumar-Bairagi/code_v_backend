const adminService = require('../../../services/v1/admin/adminService');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const data = await adminService.login(email, password);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const data = await adminService.getMe(req.adminId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const data = await adminService.updateProfile(req.adminId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const data = await adminService.changePassword(req.adminId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function dashboardStats(req, res, next) {
  try {
    const data = await adminService.getDashboardStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const data = await adminService.listUsersPaginated(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const data = await adminService.getUserById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const data = await adminService.createUser(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const data = await adminService.updateUser(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function patchUserStatus(req, res, next) {
  try {
    const data = await adminService.updateUserStatus(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listCompanies(req, res, next) {
  try {
    const data = await adminService.listCompaniesPaginated(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getCompany(req, res, next) {
  try {
    const data = await adminService.getUserById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function patchCompanyStatus(req, res, next) {
  try {
    const data = await adminService.updateUserStatus(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function patchCompanyCreator(req, res, next) {
  try {
    const isCreator = Boolean(req.body?.isCreator);
    const data = await adminService.updateUser(req.params.id, { isCreator });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listCities(req, res, next) {
  try {
    const data = await adminService.listCities(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createCity(req, res, next) {
  try {
    const data = await adminService.createCity(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateCity(req, res, next) {
  try {
    const data = await adminService.updateCity(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function bulkCityStatus(req, res, next) {
  try {
    const data = await adminService.bulkSetCityStatus(req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function deleteCity(req, res, next) {
  try {
    const data = await adminService.deleteCity(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listBookings(req, res, next) {
  try {
    const data = await adminService.listBookingsPaginated(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getBooking(req, res, next) {
  try {
    const data = await adminService.getBookingById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listLegal(req, res, next) {
  try {
    const data = await adminService.listLegalDocuments({ includeInactive: true });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateLegal(req, res, next) {
  try {
    const data = await adminService.updateLegalBySlug(req.params.slug, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getPlatformSettings(req, res, next) {
  try {
    const data = await adminService.getPlatformSettings();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updatePlatformSettings(req, res, next) {
  try {
    const data = await adminService.mergePlatformSettings(req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listBioRequests(req, res, next) {
  try {
    const data = await adminService.listBioRequests(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function reviewBioRequest(req, res, next) {
  try {
    const data = await adminService.reviewBioRequest(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  me,
  updateProfile,
  changePassword,
  dashboardStats,
  listUsers,
  getUser,
  createUser,
  updateUser,
  patchUserStatus,
  listCompanies,
  getCompany,
  patchCompanyStatus,
  patchCompanyCreator,
  listCities,
  createCity,
  updateCity,
  deleteCity,
  bulkCityStatus,
  listBookings,
  getBooking,
  listLegal,
  updateLegal,
  getPlatformSettings,
  updatePlatformSettings,
  listBioRequests,
  reviewBioRequest,
};
