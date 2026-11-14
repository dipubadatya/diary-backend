import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export interface SentenceTiming {
  index: number;
  text: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface TTSResult {
  audioUrl: string;
  duration: number; // in seconds
  sentences: SentenceTiming[];
  cached: boolean;
}

export type SupportedLanguage = 'en' | 'hi' | 'or';

// Cache directory anchored to backend root
const CACHE_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'tts_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Active jobs to prevent redundant concurrent synthesis
const activeJobs = new Map<string, Promise<TTSResult>>();

/**
 * Phonetic transliteration from Odia script (U+0B00–U+0B7F)
 * to Devanagari script (U+0900–U+097F).
 * Both share the same Brahmi phonetic ordering, allowing natural neural Indian voices
 * to pronounce Odia text with human-level accuracy.
 */
export function odiaToDevanagari(text: string): string {
  let res = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0B00 && code <= 0x0B7F) {
      if (code === 0x0B71 || code === 0x0B35) {
        res += String.fromCharCode(0x0935); // Odia WA/VA ୱ -> Devanagari व
      } else if (code === 0x0B5F) {
        res += String.fromCharCode(0x092F); // Odia YYA ୟ -> Devanagari य
      } else if (code === 0x0B5C) {
        res += String.fromCharCode(0x0921, 0x093C); // Odia RRA ଡ଼ -> Devanagari ड़
      } else if (code === 0x0B5D) {
        res += String.fromCharCode(0x0922, 0x093C); // Odia RHA ଢ଼ -> Devanagari ढ़
      } else if (code === 0x0B33) {
        res += String.fromCharCode(0x0933); // Odia LLA ଳ -> Devanagari ळ
      } else {
        const deva = code - 0x0B00 + 0x0900;
        res += String.fromCharCode(deva);
      }
    } else {
      res += text[i];
    }
  }
  return res;
}

/**
 * Detect script/language from text
 */
export function detectLanguage(text: string): SupportedLanguage {
  let odiaCount = 0;
  let devanagariCount = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0B00 && code <= 0x0B7F) odiaCount++;
    else if (code >= 0x0900 && code <= 0x097F) devanagariCount++;
  }

  if (odiaCount > 5) return 'or';
  if (devanagariCount > 5) return 'hi';
  return 'en';
}

/**
 * Split text into clean sentences preserving sentence punctuation
 */
export function splitIntoSentences(text: string): string[] {
  // Clean HTML if any
  const plain = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plain) return [];

  // Match sentences ending in . ! ? । (Devanagari/Odia danda)
  const regex = /[^.!?।]+[.!?।]*/g;
  const matches = plain.match(regex);
  if (!matches) return [plain];

  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Select the single best neural voice for the specified language
 */
function getVoiceForLanguage(lang: SupportedLanguage): { voice: string; isTransliterated: boolean } {
  switch (lang) {
    case 'hi':
      return { voice: 'hi-IN-SwaraNeural', isTransliterated: false };
    case 'or':
      return { voice: 'hi-IN-SwaraNeural', isTransliterated: true };
    case 'en':
    default:
      return { voice: 'en-US-JennyNeural', isTransliterated: false };
  }
}

/**
 * Synthesize story audio using Microsoft Edge Neural TTS with server caching
 */
export async function synthesizeStoryAudio(
  rawText: string,
  requestedLang?: SupportedLanguage,
  _storyId?: string
): Promise<TTSResult> {
  const lang: SupportedLanguage = requestedLang || detectLanguage(rawText);
  const { voice, isTransliterated } = getVoiceForLanguage(lang);

  // Clean and prepare original text
  const cleanOriginal = rawText
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanOriginal) {
    throw new Error('Text to synthesize cannot be empty.');
  }

  // Pre-split original sentences for mapping
  const originalSentences = splitIntoSentences(cleanOriginal);

  // Generate phonetically prepared text
  const textToSpeak = isTransliterated ? odiaToDevanagari(cleanOriginal) : cleanOriginal;

  // Cache key based on language, voice, and normalized content
  const hash = crypto
    .createHash('sha256')
    .update(`${lang}:${voice}:${textToSpeak}`)
    .digest('hex')
    .slice(0, 32);

  const audioFileName = `${hash}.mp3`;
  const metaFileName = `${hash}.json`;
  const audioFilePath = path.join(CACHE_DIR, audioFileName);
  const metaFilePath = path.join(CACHE_DIR, metaFileName);

  const publicAudioUrl = `/api/tts/audio/${audioFileName}`;

  // 1. Check if cached files exist and are valid
  if (fs.existsSync(audioFilePath) && fs.existsSync(metaFilePath)) {
    try {
      const cachedMeta = JSON.parse(fs.readFileSync(metaFilePath, 'utf8'));
      if (fs.statSync(audioFilePath).size > 0 && Array.isArray(cachedMeta.sentences)) {
        return {
          audioUrl: publicAudioUrl,
          duration: cachedMeta.duration,
          sentences: cachedMeta.sentences,
          cached: true,
        };
      }
    } catch {
      // If corrupted, re-generate
    }
  }

  // 2. Check if identical job is already running
  if (activeJobs.has(hash)) {
    return await activeJobs.get(hash)!;
  }

  // 3. Run synthesis job
  const jobPromise = (async (): Promise<TTSResult> => {
    const tempDir = path.join(CACHE_DIR, `temp_${hash}_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const tts = new MsEdgeTTS({
        connectionTimeoutMs: 25000,
        synthesisTimeoutMs: 45000,
      });
      await tts.setMetadata(
        voice,
        OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
        { sentenceBoundaryEnabled: true, wordBoundaryEnabled: false }
      );

      // Synthesize to tempDir
      const res = await tts.toFile(tempDir, textToSpeak);

      // Verify audio exists
      if (!fs.existsSync(res.audioFilePath) || fs.statSync(res.audioFilePath).size === 0) {
        throw new Error('TTS engine did not produce audio data.');
      }

      // Parse metadata if available
      let sentenceTimings: SentenceTiming[] = [];
      let totalDuration = 0;

      if (res.metadataFilePath && fs.existsSync(res.metadataFilePath)) {
        try {
          const rawMeta = JSON.parse(fs.readFileSync(res.metadataFilePath, 'utf8'));
          const boundaries = (rawMeta.Metadata || []).filter(
            (m: any) => m.Type === 'SentenceBoundary' && m.Data
          );

          sentenceTimings = boundaries.map((b: any, i: number) => {
            const startSec = (b.Data.Offset || 0) / 10000000;
            const durSec = (b.Data.Duration || 0) / 10000000;
            const endSec = startSec + durSec;
            if (endSec > totalDuration) totalDuration = endSec;

            // Map back to original sentence text if available
            const originalText = originalSentences[i] || b.Data.text?.Text || '';

            return {
              index: i,
              text: originalText,
              start: Number(startSec.toFixed(2)),
              end: Number(endSec.toFixed(2)),
            };
          });
        } catch (err) {
          console.warn('[TTS] Failed to parse sentence metadata:', err);
        }
      }

      // Fallback if boundary metadata was not returned
      if (sentenceTimings.length === 0) {
        const words = cleanOriginal.split(/\s+/).length;
        totalDuration = Math.max(3, (words / 140) * 60);

        let curTime = 0;
        const perSentence = totalDuration / Math.max(1, originalSentences.length);
        sentenceTimings = originalSentences.map((st, i) => {
          const start = Number(curTime.toFixed(2));
          curTime += perSentence;
          const end = Number(Math.min(totalDuration, curTime).toFixed(2));
          return {
            index: i,
            text: st,
            start,
            end,
          };
        });
      }

      totalDuration = Number(totalDuration.toFixed(2));

      // Move generated audio to final cache destination
      fs.copyFileSync(res.audioFilePath, audioFilePath);

      // Write parsed metadata cache
      fs.writeFileSync(
        metaFilePath,
        JSON.stringify(
          {
            duration: totalDuration,
            sentences: sentenceTimings,
            voice,
            lang,
            createdAt: new Date().toISOString(),
          },
          null,
          2
        )
      );

      return {
        audioUrl: publicAudioUrl,
        duration: totalDuration,
        sentences: sentenceTimings,
        cached: false,
      };
    } finally {
      // Clean up temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
      activeJobs.delete(hash);
    }
  })();

  activeJobs.set(hash, jobPromise);
  return await jobPromise;
}

/**
 * Get file path of cached audio
 */
export function getCachedAudioPath(filename: string): string | null {
  // Sanitize filename
  const clean = path.basename(filename);
  if (!clean.endsWith('.mp3')) return null;

  const fullPath = path.join(CACHE_DIR, clean);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}
