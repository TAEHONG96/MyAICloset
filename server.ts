import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractGarmentMetadataFromImage,
  formatGeminiError,
  generateClosetDiagnosis,
  generateFashionAssistantReply,
  generateOutfitPreviewBlueprint,
  generateOutfitRecommendations,
  generatePurchaseAdvice,
} from './server/gemini';
import {
  createCorsMiddleware,
  createRateLimitMiddleware,
  parseAllowedOrigins,
  securityHeadersMiddleware,
} from './server/security';
import type {
  OutfitRecommendation,
  PurchaseCandidate,
  StylePreferences,
  WardrobeItem,
} from './src/types/wardrobe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_OWNED_ITEMS = 200;
const MAX_CHAT_HISTORY = 50;

function resolveDistPath(): string {
  // When bundled as dist/server.js, __dirname is dist/ (contains index.html).
  // When run via tsx server.ts from repo root, dist is path.resolve(__dirname, 'dist').
  if (fs.existsSync(path.join(__dirname, 'index.html'))) {
    return __dirname;
  }
  const siblingDist = path.resolve(__dirname, 'dist');
  if (fs.existsSync(path.join(siblingDist, 'index.html'))) {
    return siblingDist;
  }
  return path.resolve(process.cwd(), 'dist');
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS, [
    process.env.RENDER_EXTERNAL_URL,
    process.env.APP_URL,
  ]);

  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX) || 20;
  const previewRateLimitMax = Number(process.env.PREVIEW_RATE_LIMIT_MAX) || 8;

  const apiRateLimiter = createRateLimitMiddleware({
    windowMs: rateLimitWindowMs,
    max: rateLimitMax,
    keyPrefix: 'ai-api',
  });

  const previewRateLimiter = createRateLimitMiddleware({
    windowMs: rateLimitWindowMs,
    max: previewRateLimitMax,
    keyPrefix: 'ai-preview',
  });

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(securityHeadersMiddleware);
  app.use(createCorsMiddleware({ allowedOrigins, isProduction }));
  app.use(express.json({ limit: '6mb' }));

  // Render & platform health check endpoints (unauthenticated, no AI call)
  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, status: 'ok', service: 'my-ai-closet' });
  });

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true, status: 'ok', service: 'my-ai-closet' });
  });

  app.use('/api/wardrobe', apiRateLimiter);

  app.post('/api/wardrobe/extract-image-metadata', async (req, res) => {
    try {
      const { imageDataUrl, hintName } = req.body as {
        imageDataUrl?: string;
        hintName?: string;
      };
      if (!imageDataUrl || typeof imageDataUrl !== 'string') {
        res.status(400).json({ error: '메타데이터를 추출할 의류 이미지가 필요합니다.' });
        return;
      }
      const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ error: '지원되는 이미지 데이터 형식(Data URL)이 아닙니다.' });
        return;
      }
      const [, mimeType, base64Data] = match;
      const metadata = await extractGarmentMetadataFromImage({
        base64Data,
        mimeType,
        hintName,
      });
      res.json({ metadata });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/wardrobe/analyze', async (req, res) => {
    try {
      const { ownedItems } = req.body as { ownedItems?: WardrobeItem[] };
      if (!Array.isArray(ownedItems) || ownedItems.length === 0) {
        res.status(400).json({ error: '분석할 보유 의류가 최소 1벌 이상 필요합니다.' });
        return;
      }
      const diagnosis = await generateClosetDiagnosis(ownedItems.slice(0, MAX_OWNED_ITEMS));
      res.json({ diagnosis });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/wardrobe/recommend', async (req, res) => {
    try {
      const { ownedItems, preferences } = req.body as {
        ownedItems?: WardrobeItem[];
        preferences?: StylePreferences;
      };
      if (!Array.isArray(ownedItems) || ownedItems.length < 2) {
        res
          .status(400)
          .json({ error: '코디 조합을 추천하려면 옷장에 최소 2벌 이상의 의류가 등록되어 있어야 합니다.' });
        return;
      }
      if (!preferences) {
        res.status(400).json({ error: '스타일 선호도 정보가 필요합니다.' });
        return;
      }
      const outfits = await generateOutfitRecommendations(
        ownedItems.slice(0, MAX_OWNED_ITEMS),
        preferences
      );
      res.json({ outfits });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/wardrobe/purchase-advice', async (req, res) => {
    try {
      const { ownedItems, candidate } = req.body as {
        ownedItems?: WardrobeItem[];
        candidate?: PurchaseCandidate;
      };
      if (!Array.isArray(ownedItems)) {
        res.status(400).json({ error: '보유 의류 목록이 필요합니다.' });
        return;
      }
      if (!candidate?.name?.trim() || !candidate?.color?.trim()) {
        res.status(400).json({ error: '구매 후보 아이템의 이름과 색상을 입력해 주세요.' });
        return;
      }
      const advice = await generatePurchaseAdvice(ownedItems.slice(0, MAX_OWNED_ITEMS), candidate);
      res.json({ advice });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/wardrobe/outfit-preview', previewRateLimiter, async (req, res) => {
    try {
      const { outfit, ownedItems } = req.body as {
        outfit?: OutfitRecommendation;
        ownedItems?: WardrobeItem[];
      };
      if (!outfit || !Array.isArray(ownedItems) || outfit.itemIds.length === 0) {
        res.status(400).json({ error: '실사 코디 이미지를 생성할 추천 코디와 보유 의류 정보가 필요합니다.' });
        return;
      }
      const preview = await generateOutfitPreviewBlueprint(
        outfit,
        ownedItems.slice(0, MAX_OWNED_ITEMS)
      );
      res.json({ preview });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/wardrobe/chat', async (req, res) => {
    try {
      const { ownedItems, preferences, outfits, purchaseCandidate, history, message, attachments } =
        req.body as {
          ownedItems?: WardrobeItem[];
          preferences?: StylePreferences;
          outfits?: OutfitRecommendation[];
          purchaseCandidate?: PurchaseCandidate;
          history?: Array<{ role: 'user' | 'assistant'; content: string }>;
          message?: string;
          attachments?: {
            itemIds?: string[];
            outfitIds?: string[];
            includeClosetSummary?: boolean;
            includePurchaseCandidate?: boolean;
          };
        };

      if (!message?.trim()) {
        res.status(400).json({ error: '질문 내용을 입력해 주세요.' });
        return;
      }

      const result = await generateFashionAssistantReply({
        ownedItems: Array.isArray(ownedItems) ? ownedItems.slice(0, MAX_OWNED_ITEMS) : [],
        preferences: preferences ?? {
          occasion: '데일리/캐주얼',
          season: '사계절',
          preferredStyle: '미니멀',
          additionalNotes: '',
        },
        outfits: Array.isArray(outfits) ? outfits.slice(0, 10) : [],
        purchaseCandidate: purchaseCandidate ?? {
          name: '',
          category: '상의',
          color: '',
          style: '미니멀',
          fit: '레귤러핏',
          season: '사계절',
          priceKrw: '',
          notes: '',
        },
        history: Array.isArray(history) ? history.slice(-MAX_CHAT_HISTORY) : [],
        message: message.trim().slice(0, 2000),
        attachments,
      });

      res.json(result);
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Unmatched /api/* routes return JSON 404 rather than SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: '요청하신 API 경로를 찾을 수 없습니다.' });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = resolveDistPath();
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      console.warn(`[startup] Production build not found in ${distPath}. Run "npm run build" first.`);
    }
    app.use(express.static(distPath, { index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler — never expose internal stacks or environment secrets
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { type?: string; status?: number };
    if (e?.type === 'entity.too.large' || e?.status === 413) {
      res.status(413).json({ error: '요청 데이터 크기가 허용 한도(6MB)를 초과했습니다.' });
      return;
    }
    if (e instanceof SyntaxError) {
      res.status(400).json({ error: '올바른 JSON 형식의 요청이 아닙니다.' });
      return;
    }
    console.error('[server-error] unhandled error');
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err instanceof Error ? err.message : 'unknown error');
  process.exit(1);
});
