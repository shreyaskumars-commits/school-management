import { checkValues } from "../utils/validators.js";

export function validateStudent(req, res, next) {
  const { name, department } = req.body ?? {};
  if (name === undefined || department === undefined) {
    return res.status(400).json({
      error: "name and department are required",
    });
  }
  const problem = checkValues(req.body);
  if (problem) {
    return res.status(422).json({ error: problem });
  }
  next();
}
