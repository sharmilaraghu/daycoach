/**
 * In-memory audio store.
 * Stores generated audio buffers keyed by UUID.
 * Entries expire after 1 hour to prevent memory leaks.
 */
import { randomUUID } from "crypto";

interface AudioEntry {
  buffer: Buffer;
  mimeType: string;
  expiresAt: number;
}

const store = new Map<string, AudioEntry>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

function cleanup() {
  const now = Date.now();
  for (const [id, entry] of store.entries()) {
    if (entry.expiresAt < now) {
      store.delete(id);
    }
  }
}

// Cleanup every 10 minutes
setInterval(cleanup, 10 * 60 * 1000);

export function storeAudio(buffer: Buffer, mimeType = "audio/mpeg"): string {
  const id = randomUUID();
  store.set(id, {
    buffer,
    mimeType,
    expiresAt: Date.now() + TTL_MS,
  });
  return id;
}

export function getAudio(id: string): AudioEntry | undefined {
  return store.get(id);
}
