// log every request, then pass control on
export function logger(req, res, next) {
  console.log(req.method, req.url);
  next();
}
