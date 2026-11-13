import { SchoolReview } from "../models/SchoolReview.js";
import {
  getSettings, updateSettings, validateConfig, publicView,
} from "../services/settingsService.js";

async function fullView() {
  const s = (await getSettings()).toObject();
  return {
    ...publicView(s),
    version: s.version,
    prompts: s.prompts,
    schoolRows: await SchoolReview.countDocuments(),
  };
}

export async function getConfig(req, res) {
  res.json(await fullView());
}

export async function putConfig(req, res) {
  const { error, patch } = validateConfig(req.body ?? {});
  if (error) return res.status(400).json({ error });
  await updateSettings(patch);
  res.json(await fullView());
}

