import express, { Request, Response } from 'express';
import fs from 'fs';
import {
  synthesizeStoryAudio,
  getCachedAudioPath,
  SupportedLanguage,
  detectLanguage,
} from '../services/tts.service';

const router = express.Router();

/**
 * GET /api/tts/languages
 * Returns list of supported language options
 */
router.get('/languages', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    languages: [
      { code: 'en', name: 'English', native: 'English', flag: '🇺🇸' },
      { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
      { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
    ],
  });
});

/**
 * POST /api/tts/synthesize
 * Synthesize story text to natural neural speech with sentence boundary timings
 */
router.post('/synthesize', async (req: Request, res: Response) => {
  try {
    const { text, lang, storyId } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide valid text to synthesize.',
      });
    }

    if (text.length > 50000) {
      return res.status(400).json({
        success: false,
        error: 'Text length exceeds the maximum limit of 50,000 characters.',
      });
    }

    const validLangs: SupportedLanguage[] = ['en', 'hi', 'or'];
    const chosenLang: SupportedLanguage = validLangs.includes(lang)
      ? lang
      : detectLanguage(text);

    const result = await synthesizeStoryAudio(text, chosenLang, storyId);

    return res.status(200).json({
      success: true,
      lang: chosenLang,
      ...result,
    });
  } catch (error: any) {
    console.error('[TTS Controller Error]:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to synthesize story speech.',
    });
  }
});

/**
 * GET /api/tts/audio/:filename
 * Stream synthesized MP3 audio with full HTTP byte-range support for seeking
 */
router.get('/audio/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = getCachedAudioPath(filename);

  if (!filePath) {
    return res.status(404).json({ error: 'Audio file not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // Handle HTTP Range header for seeking
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunksize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    return stream.pipe(res);
  } else {
    // Stream full file
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    return fs.createReadStream(filePath).pipe(res);
  }
});

export default router;

