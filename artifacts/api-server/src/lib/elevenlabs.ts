import { logger } from "./logger";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const BASE_URL = "https://api.elevenlabs.io/v1";

if (!ELEVENLABS_API_KEY) {
  logger.warn("ELEVENLABS_API_KEY is not set — voice generation will be disabled");
}

export interface VoicePreview {
  generated_voice_id: string;
  audio_base_64: string;
  media_type: string;
}

export interface ElevenLabsVoiceDesignRequest {
  voice_description: string;
  text: string;
}

/**
 * Create voice previews using Voice Design API.
 * Returns an array of preview objects, each with a generated_voice_id.
 */
export async function createVoicePreviews(description: string, sampleText: string): Promise<VoicePreview[]> {
  const res = await fetch(`${BASE_URL}/text-to-voice/create-previews`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voice_description: description,
      text: sampleText,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs create-previews failed: ${res.status} ${body}`);
  }

  const data = await res.json() as { previews: VoicePreview[] };
  return data.previews;
}

/**
 * Save a preview voice as a permanent voice in ElevenLabs.
 */
export async function saveVoiceFromPreview(
  voiceName: string,
  voiceDescription: string,
  generatedVoiceId: string,
): Promise<string> {
  const res = await fetch(`${BASE_URL}/text-to-voice/create-voice-from-preview`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voice_name: voiceName,
      voice_description: voiceDescription,
      generated_voice_id: generatedVoiceId,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs save-voice failed: ${res.status} ${body}`);
  }

  const data = await res.json() as { voice_id: string };
  return data.voice_id;
}

/**
 * Generate speech audio from text using a voice ID.
 * Returns an audio buffer (MP3).
 */
export async function generateSpeech(voiceId: string, text: string): Promise<Buffer> {
  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY!,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${body}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate a signed WebSocket URL for ElevenLabs Conversational AI.
 * Required for private agents — using agentId directly only works for public agents.
 */
export async function getConvAiSignedUrl(agentId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`, {
    method: "GET",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY!,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs signed URL failed: ${res.status} ${body}`);
  }

  const data = await res.json() as { signed_url: string };
  return data.signed_url;
}

/**
 * Check if ElevenLabs is configured.
 */
export function isElevenLabsConfigured(): boolean {
  return !!ELEVENLABS_API_KEY;
}
