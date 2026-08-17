// Port of server/index.js's POST /api/whoop/token. Kept server-side because
// it requires WHOOP_CLIENT_SECRET, which must never ship to the client
// bundle. Expects: { code, redirect_uri? } -- redirect_uri should be the
// exact value used to build the authorization URL (falls back to the
// WHOOP_REDIRECT_URI binding if the client doesn't send one).
import type { Env } from '../../_lib/env';
import { getWhoopClientId, getWhoopClientSecret, getWhoopRedirectUri } from '../../_lib/env';
import { json, preflight } from '../../_lib/cors';
import { checkRateLimit, clientKey } from '../../_lib/rateLimit';

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

export const onRequestOptions: PagesFunction<Env> = async () => preflight();

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const allowed = await checkRateLimit(env, `whoop-token:${clientKey(request)}`);
  if (!allowed) {
    return json({ error: 'Too many requests, try again later.' }, { status: 429 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const { code, redirect_uri: redirectUriFromBody } = body || {};

  if (!code) {
    return json({ error: 'code is required' }, { status: 400 });
  }

  const clientId = getWhoopClientId(env);
  const clientSecret = getWhoopClientSecret(env);

  if (!clientId || !clientSecret) {
    return json({ error: 'WHOOP client credentials not configured on server' }, { status: 500 });
  }

  const redirectUri = redirectUriFromBody || getWhoopRedirectUri(env);
  if (!redirectUri) {
    return json(
      { error: 'redirect_uri is required (none provided and WHOOP_REDIRECT_URI is not set)' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[functions] WHOOP token exchange error:', response.status, error);
      return json({ error: 'Failed to exchange code for token', details: error }, { status: 502 });
    }

    const data: any = await response.json();
    return json({ access_token: data.access_token, refresh_token: data.refresh_token });
  } catch (err: any) {
    console.error('[functions] /api/whoop/token error:', err);
    return json(
      { error: err.message || 'Failed to exchange code for token', details: err.toString() },
      { status: 502 },
    );
  }
};
