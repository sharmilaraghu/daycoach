import { Router } from "express";
import { getAudio } from "../lib/audioStore";

const router = Router();

// GET /api/audio/:id
router.get("/audio/:id", (req, res) => {
  const entry = getAudio(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "Audio not found or expired" });
    return;
  }
  res.set({
    "Content-Type": entry.mimeType,
    "Content-Length": entry.buffer.length,
    "Cache-Control": "no-cache",
  });
  res.send(entry.buffer);
});

export default router;
