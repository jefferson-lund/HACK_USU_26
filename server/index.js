// Simple backend proxy for OpenAI so the Expo app (web and native) never calls OpenAI directly.

// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 4000;

// Prefer a server-side secret name, but fall back to the existing one if needed.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;
console.log('Key loaded:', !!OPENAI_API_KEY);

app.use(cors({ origin: '*', methods: ['POST'] }));
app.use(express.json());

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

app.listen(port, '0.0.0.0', () => {
  console.log(
    `[backend] Hypothesis server listening on port ${port}. Set EXPO_PUBLIC_API_BASE_URL to http://<your-ip>:${port} in the Expo app.`,
  );
});

