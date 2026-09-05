import mongoose from 'mongoose';

import { env } from '../config/env.js';

const resolveStatus = (err, res) => {
  if (err.status) return err.status;
  if (err.statusCode) return err.statusCode;
  // Controllers may signal intent with res.status(...) before throwing.
  if (res.statusCode && res.statusCode !== 200) return res.statusCode;
  if (err instanceof mongoose.Error.ValidationError) return 400;
  if (err instanceof mongoose.Error.VersionError) return 409;
  if (err instanceof mongoose.Error.CastError) return 400;
  if (err.code === 11000) return 409;
  return 500;
};

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export const errorHandler = (err, req, res, next) => {
  const status = resolveStatus(err, res);

  if (status >= 500) {
    console.error('[kingdom-network]', err);
  }

  res.status(status).json({
    success: false,
    message: err instanceof mongoose.Error.VersionError ? 'This application changed in another request. Refresh it and try again.' : err.message || 'Internal server error',
    ...(env.isProduction ? {} : { stack: err.stack }),
  });
};
