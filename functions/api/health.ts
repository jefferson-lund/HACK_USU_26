import type { Env } from '../_lib/env';
import { json } from '../_lib/cors';

// Not rate-limited, mirroring server/index.js's /api/health.
export const onRequestGet: PagesFunction<Env> = async () => {
  return json({ ok: true, message: 'API is reachable' });
};
