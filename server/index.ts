import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import type { CobolFormatMode, ProblemSpec } from '../src/types/schema';
import { executeCobolServer } from './cobolExecutor';
import {
  getCompilerVersion,
  resolveCobcBinary,
  resolveRustcBinary,
} from './compilerPaths';
import { executeRustServer } from './rustExecutor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const DIST_INDEX_HTML = path.join(DIST_DIR, 'index.html');

export function createServerApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req: Request, res: Response) => {
    const rustcBin = resolveRustcBinary();
    const cobcBin = resolveCobcBinary();
    const [rustcVersion, cobcVersion] = await Promise.all([
      getCompilerVersion(rustcBin),
      getCompilerVersion(cobcBin),
    ]);

    res.json({
      ok: true,
      rustc: rustcVersion,
      cobc: cobcVersion,
      judge0Configured: Boolean(process.env.JUDGE0_API_URL?.trim()),
    });
  });

  app.post('/api/execute/rust', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        userCode?: unknown;
        problemSpec?: unknown;
        timeoutMs?: unknown;
      };

      if (typeof body?.userCode !== 'string' || !isValidProblemSpec(body?.problemSpec)) {
        res.status(400).json({
          error: 'Invalid request body: expected { userCode: string, problemSpec: ProblemSpec }.',
        });
        return;
      }

      const rawTimeout = Number(body.timeoutMs);
      const timeoutMs = Number.isFinite(rawTimeout)
        ? Math.min(Math.max(rawTimeout, 100), 15000)
        : 3000;

      const result = await executeRustServer({
        userCode: body.userCode,
        problemSpec: body.problemSpec,
        timeoutMs,
      });

      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Internal Rust execution error: ${msg}` });
    }
  });

  app.post('/api/execute/cobol', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        userCode?: unknown;
        problemSpec?: unknown;
        cobolFormat?: unknown;
        timeoutMs?: unknown;
      };

      if (typeof body?.userCode !== 'string' || !isValidProblemSpec(body?.problemSpec)) {
        res.status(400).json({
          error: 'Invalid request body: expected { userCode: string, problemSpec: ProblemSpec }.',
        });
        return;
      }

      const cobolFormat: CobolFormatMode =
        body.cobolFormat === 'fixed' ? 'fixed' : 'free';
      const rawTimeout = Number(body.timeoutMs);
      const timeoutMs = Number.isFinite(rawTimeout)
        ? Math.min(Math.max(rawTimeout, 100), 15000)
        : 2000;

      const result = await executeCobolServer({
        userCode: body.userCode,
        problemSpec: body.problemSpec,
        cobolFormat,
        timeoutMs,
      });

      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Internal COBOL execution error: ${msg}` });
    }
  });

  // Production static asset serving & SPA fallback when `dist/index.html` exists
  if (fs.existsSync(DIST_INDEX_HTML)) {
    app.use(express.static(DIST_DIR));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) {
        next();
        return;
      }
      // Pass `root: DIST_DIR` so parent dot-directories (e.g. `~/.gemini/...`) never trip Express `send` dotfile checks
      res.sendFile('index.html', { root: DIST_DIR });
    });
  }

  return app;
}

function isValidProblemSpec(val: unknown): val is ProblemSpec {
  if (!val || typeof val !== 'object') return false;
  const spec = val as Partial<ProblemSpec>;
  return (
    typeof spec.functionName === 'string' && Array.isArray(spec.tests)
  );
}

const isDirectEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectEntry) {
  const port = Number(process.env.PORT) || 3001;
  const app = createServerApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(`[CodeByHand API] Listening on http://127.0.0.1:${port}`);
  });
}
