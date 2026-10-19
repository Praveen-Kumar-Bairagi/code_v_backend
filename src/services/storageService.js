/**
 * File storage — same pattern as compameet-backend.
 * Saves under public/user for profile photos.
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');

const PUBLIC_ROOT = path.join(process.cwd(), 'public');
const BASE_URL = (
  process.env.BASE_URL ||
  process.env.PUBLIC_API_URL ||
  `http://localhost:${process.env.PORT || 2002}`
).replace(/\/$/, '');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const getPublicSubdir = (subdir) => {
  const dir = path.join(PUBLIC_ROOT, subdir);
  ensureDir(dir);
  return dir;
};

/**
 * @param {Express.Multer.File} file
 * @param {string} subdir
 * @returns {Promise<string>} e.g. /public/user/uuid.jpg
 */
const saveProfilePicture = async (file, subdir = 'user') => {
  if (!file) {
    throw new AppError('No file provided', 400);
  }

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    throw new AppError('Only JPEG, PNG, and WebP images are allowed', 400);
  }

  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const filename = `${uuidv4()}${ext}`;
  const destDir = getPublicSubdir(subdir);
  const destPath = path.join(destDir, filename);

  if (file.buffer) {
    fs.writeFileSync(destPath, file.buffer);
  } else if (file.path) {
    fs.renameSync(file.path, destPath);
  } else {
    throw new AppError('Invalid uploaded file', 400);
  }

  return `/public/${subdir}/${filename}`;
};

const deleteProfilePicture = async (relativePath) => {
  if (!relativePath || String(relativePath).startsWith('http')) return;
  const cleaned = String(relativePath).replace(/^\//, '').replace(/\\/g, '/');
  if (cleaned.includes('..') || !cleaned.startsWith('public/')) return;
  const absolute = path.resolve(process.cwd(), cleaned);
  const publicRoot = path.resolve(PUBLIC_ROOT);
  if (!absolute.startsWith(publicRoot + path.sep) && absolute !== publicRoot) return;
  if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
};

const getPublicUrl = (relativePath) => {
  if (!relativePath) return null;
  if (String(relativePath).startsWith('http')) return relativePath;
  return `${BASE_URL}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
};

ensureDir(path.join(PUBLIC_ROOT, 'user'));

module.exports = {
  saveProfilePicture,
  deleteProfilePicture,
  getPublicUrl,
  PUBLIC_ROOT,
};
