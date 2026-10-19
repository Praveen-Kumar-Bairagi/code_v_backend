class AppError extends Error {
  constructor(message, statusCode = 400, code = undefined) {
    super(message);
    this.statusCode = statusCode;
    if (code) this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
