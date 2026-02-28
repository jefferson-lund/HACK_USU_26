// Simple backend proxy for OpenAI so the Expo app (web and native) never calls OpenAI directly.

const path = require('path');

// Load environment variables from project root
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 4000;

// Prefer a server-side secret name, but fall back to the existing one if needed.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
console.log('OpenAI key loaded:', !!OPENAI_API_KEY);
console.log('Gemini key loaded:', !!GEMINI_API_KEY);
console.log('Gemini key (EXPO_PUBLIC_GEMINI_API_KEY) present:', !!process.env.EXPO_PUBLIC_GEMINI_API_KEY);

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log('[backend] Incoming:', req.method, req.originalUrl);
  next();
});

const apiRouter = express.Router();

// Health check for debugging
apiRouter.get('/health', (req, res) => {
  res.json({ ok: true, message: 'API is reachable' });
});

// Explicit OPTIONS for CORS preflight
apiRouter.options('/weekly-plan', (req, res) => res.sendStatus(204));
apiRouter.options('/hypothesis', (req, res) => res.sendStatus(204));

function extractJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();
  return JSON.parse(cleaned);
}

apiRouter.post('/hypothesis', async (req, res) => {
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

    console.log('[backend] Calling OpenAI for hypothesis…');

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

    console.log('[backend] OpenAI hypothesis generated.');
    return res.status(200).json({ hypothesis: content, usedFallback: false });
  } catch (error) {
    console.error('[backend] Error generating hypothesis:', error);
    return res.status(200).json({
      hypothesis: 'My working hypothesis is that being consistent with my chosen activities will help me move toward my outcome.',
      usedFallback: true,
    });
  }
});

// POST /api/weekly-plan
// Expects: { outcome_goal, current_average_outcome?, time_constraints?, preferences?, regression_summary: { r_squared, n_days, activities } }
apiRouter.post('/weekly-plan', async (req, res) => {
  console.log('[backend] POST /api/weekly-plan hit');
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
        model: 'gpt-3.5-turbo',
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

app.use('/api', apiRouter);

// Backward compatibility: also mount hypothesis at root path
app.options('/hypothesis', (req, res) => res.sendStatus(204));
app.post('/hypothesis', async (req, res) => {
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

    console.log('[backend] Calling OpenAI for hypothesis…');

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

    console.log('[backend] OpenAI hypothesis generated.');
    return res.status(200).json({ hypothesis: content, usedFallback: false });
  } catch (error) {
    console.error('[backend] Error generating hypothesis:', error);
    return res.status(200).json({
      hypothesis: 'My working hypothesis is that being consistent with my chosen activities will help me move toward my outcome.',
      usedFallback: true,
    });
  }
});

// Catch-all 404 handler for debugging
app.use((req, res) => {
  console.log('[backend] 404 - Requested URL:', req.method, req.originalUrl);
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

app.listen(port, '0.0.0.0', () => {
  console.log(
    `[backend] Hypothesis server listening on port ${port}. Set EXPO_PUBLIC_API_BASE_URL to http://<your-ip>:${port} in the Expo app.`,
  );
});

