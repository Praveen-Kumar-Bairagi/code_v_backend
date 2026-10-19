const AppError = require('../utils/AppError');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Resource already exists';
  } else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = err.errors?.map((e) => e.message).join(', ') || message;
  } else if (!(err instanceof AppError) && statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err instanceof AppError && err.code ? { code: err.code } : {}),
  });
}

module.exports = errorHandler;
