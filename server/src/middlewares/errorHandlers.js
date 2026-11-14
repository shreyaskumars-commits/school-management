export function notFound(req, res) {
  res.status(404).json({
    error: `Not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  const status = err.status ?? 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error:
      status === 500 ? "Something went wrong" : err.message,
  });
}
