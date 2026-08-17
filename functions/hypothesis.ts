// Root-level mount, mirroring server/index.js's backward-compatibility
// `app.post('/hypothesis', ...)` alongside `/api/hypothesis` -- lib/llm.ts's
// generateHypothesis() calls this path, not the /api one.
import type { Env } from './_lib/env';
import { handleHypothesis } from './_lib/hypothesis';
import { preflight } from './_lib/cors';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return handleHypothesis(context.request, context.env);
};

export const onRequestOptions: PagesFunction<Env> = async () => preflight();
