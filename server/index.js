// Simple backend proxy for OpenAI so the Expo app (web and native) never calls OpenAI directly.

const path = require('path');

// Load environment variables from project root
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 4000;

// Prefer a server-side secret name, but fall back to the existing one if needed.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const WHOOP_CLIENT_ID = process.env.WHOOP_CLIENT_ID || process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID;
const WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET || process.env.EXPO_PUBLIC_WHOOP_CLIENT_SECRET;
const WHOOP_REDIRECT_URI = process.env.WHOOP_REDIRECT_URI || process.env.EXPO_PUBLIC_WHOOP_REDIRECT_URI;
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
console.log('OpenAI key loaded:', !!OPENAI_API_KEY);
console.log('WHOOP client credentials loaded:', !!WHOOP_CLIENT_ID && !!WHOOP_CLIENT_SECRET);

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// Minimal in-memory fixed-window rate limiter for the AI-backed / external-API
// routes, so a single client can't run up unlimited OpenAI/WHOOP costs. Not
// meant to be bulletproof (per-IP, in-memory, resets on restart) — just a
// cheap guardrail given the server binds 0.0.0.0 with an open CORS policy.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitBuckets = new Map(); // ip -> { count, windowStart }

function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);

  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(ip, { count: 1, windowStart: now });
    return next();
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests, try again later.' });
  }

  return next();
}

const apiRouter = express.Router();

// Health check for debugging (intentionally not rate-limited)
apiRouter.get('/health', (req, res) => {
  res.json({ ok: true, message: 'API is reachable' });
});

// Explicit OPTIONS for CORS preflight
apiRouter.options('/weekly-plan', (req, res) => res.sendStatus(204));
apiRouter.options('/hypothesis', (req, res) => res.sendStatus(204));
apiRouter.options('/whoop/token', (req, res) => res.sendStatus(204));

function extractJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();
  return JSON.parse(cleaned);
}

async function handleHypothesis(req, res) {
  try {
    const { outcome, activities } = req.body || {};

    if (!outcome || !Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({
        error: 'Outcome and at least one activity are required.',
      });
    }

    const trimmedOutcome = String(outcome).trim();
    const filteredActivities = activities.map((a) => String(a).trim()).filter(Boolean);

    const fallback = () =>
      `My working hypothesis is that regularly ${filteredActivities.join(
        ', ',
      )} will help me ${trimmedOutcome}.`;

    if (!OPENAI_API_KEY) {
      return res.status(200).json({ hypothesis: fallback(), usedFallback: true });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You help users define a clear, simple working hypothesis about how their daily activities affect a wellness outcome. Respond with a single concise first-person sentence and nothing else.',
          },
          {
            role: 'user',
            content: [
              `Wellness outcome: "${trimmedOutcome}".`,
              `Daily activities the user believes matter: ${filteredActivities
                .map((a) => `"${a}"`)
                .join(', ')}.`,
              'Write one sentence that starts with "My working hypothesis is that" and clearly connects the activities to the outcome, in a neutral, non-judgmental tone. Make sure there is correct grammar and parallelism between the activities and the outcome. Make this sentence sound fluid and human-like.',
            ].join(' '),
          },
        ],
        temperature: 0.4,
        max_tokens: 80,
      }),
    });

    if (!response.ok) {
      console.error('[backend] OpenAI API error:', response.status, await response.text());
      return res.status(200).json({ hypothesis: fallback(), usedFallback: true });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error('[backend] No content returned from OpenAI.');
      return res.status(200).json({ hypothesis: fallback(), usedFallback: true });
    }

    return res.status(200).json({ hypothesis: content, usedFallback: false });
  } catch (error) {
    console.error('[backend] Error generating hypothesis:', error);
    return res.status(200).json({
      hypothesis: 'My working hypothesis is that being consistent with my chosen activities will help me move toward my outcome.',
      usedFallback: true,
    });
  }
}

apiRouter.post('/hypothesis', rateLimiter, handleHypothesis);

// POST /api/weekly-plan
// Expects: { outcome_goal, current_average_outcome?, time_constraints?, preferences?, regression_summary: { r_squared, n_days, activities } }
apiRouter.post('/weekly-plan', rateLimiter, async (req, res) => {
  const body = req.body;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  if (
    !body ||
    !body.regression_summary ||
    !Array.isArray(body.regression_summary.activities) ||
    body.regression_summary.activities.length === 0
  ) {
    return res
      .status(400)
      .json({ error: 'regression_summary.activities is required' });
  }

  try {
    const prompt = `You are a wellness coach. Create a 7-day activity plan.

Goal: ${body.outcome_goal}
Current average outcome: ${body.current_average_outcome || 'unknown'}

Activities and their impact (coefficient):
${body.regression_summary.activities.map(a => `- ${a.name}: ${a.coefficient > 0 ? '+' : ''}${a.coefficient.toFixed(2)}`).join('\n')}

Model quality: R² = ${body.regression_summary.r_squared.toFixed(2)}, ${body.regression_summary.n_days} days of data

Create a JSON response with this structure:
{
  "summary": "Brief 1-sentence overview",
  "rationale": "Why this plan works based on the data",
  "guidelines": ["guideline 1", "guideline 2"],
  "days": [
    {
      "day_index": 0,
      "label": "Monday",
      "focus": "Brief focus for the day",
      "activities": [
        {
          "id": "act1",
          "name": "Activity name",
          "time_of_day": "morning",
          "instructions": "How to do it",
          "reason": "Why it helps"
        }
      ]
    }
  ]
}

Focus on activities with positive coefficients. Keep it simple and actionable.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const plan = JSON.parse(jsonMatch[0]);
    res.json(plan);
  } catch (err) {
    console.error('[backend] /api/weekly-plan error:', err);
    res.status(502).json({
      error: err.message || 'Failed to generate plan',
      details: err.toString()
    });
  }
});

// POST /api/whoop/token
// Exchanges a WHOOP OAuth authorization code for an access/refresh token pair.
// Kept server-side because it requires WHOOP_CLIENT_SECRET, which must never
// ship to the client bundle.
// Expects: { code, redirect_uri? } -- redirect_uri should be the exact value
// used to build the authorization URL (falls back to WHOOP_REDIRECT_URI env
// var if the client doesn't send one).
apiRouter.post('/whoop/token', rateLimiter, async (req, res) => {
  const { code, redirect_uri: redirectUriFromBody } = req.body || {};

  if (!code) {
    return res.status(400).json({ error: 'code is required' });
  }

  if (!WHOOP_CLIENT_ID || !WHOOP_CLIENT_SECRET) {
    return res.status(500).json({ error: 'WHOOP client credentials not configured on server' });
  }

  const redirectUri = redirectUriFromBody || WHOOP_REDIRECT_URI;
  if (!redirectUri) {
    return res.status(400).json({ error: 'redirect_uri is required (none provided and WHOOP_REDIRECT_URI is not set)' });
  }

  try {
    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: WHOOP_CLIENT_ID,
        client_secret: WHOOP_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[backend] WHOOP token exchange error:', response.status, error);
      return res.status(502).json({ error: 'Failed to exchange code for token', details: error });
    }

    const data = await response.json();
    return res.json({ access_token: data.access_token, refresh_token: data.refresh_token });
  } catch (err) {
    console.error('[backend] /api/whoop/token error:', err);
    return res.status(502).json({
      error: err.message || 'Failed to exchange code for token',
      details: err.toString(),
    });
  }
});

app.use('/api', apiRouter);

// Backward compatibility: also mount hypothesis at root path
app.options('/hypothesis', (req, res) => res.sendStatus(204));
app.post('/hypothesis', rateLimiter, handleHypothesis);

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

app.listen(port, '0.0.0.0', () => {
  console.log(
    `[backend] Hypothesis server listening on port ${port}. Set EXPO_PUBLIC_API_BASE_URL to http://<your-ip>:${port} in the Expo app.`,
  );
});

