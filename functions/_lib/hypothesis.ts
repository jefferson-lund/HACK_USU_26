import type { Env } from './env';
import { getOpenAiKey } from './env';
import { json } from './cors';
import { checkRateLimit, clientKey } from './rateLimit';

// Shared by functions/api/hypothesis.ts and functions/hypothesis.ts (the
// root-level backward-compat mount) -- mirrors handleHypothesis() in
// server/index.js line for line, just rewritten onto the Fetch API
// (Request/Response) instead of Express's (req, res).
export async function handleHypothesis(request: Request, env: Env): Promise<Response> {
  const allowed = await checkRateLimit(env, `hypothesis:${clientKey(request)}`);
  if (!allowed) {
    return json({ error: 'Too many requests, try again later.' }, { status: 429 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const { outcome, activities } = body || {};

  if (!outcome || !Array.isArray(activities) || activities.length === 0) {
    return json(
      { error: 'Outcome and at least one activity are required.' },
      { status: 400 },
    );
  }

  const trimmedOutcome = String(outcome).trim();
  const filteredActivities = activities.map((a: unknown) => String(a).trim()).filter(Boolean);

  const fallback = () =>
    `My working hypothesis is that regularly ${filteredActivities.join(', ')} will help me ${trimmedOutcome}.`;

  const openAiKey = getOpenAiKey(env);
  if (!openAiKey) {
    return json({ hypothesis: fallback(), usedFallback: true });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
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
                .map((a: string) => `"${a}"`)
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
      console.error('[functions] OpenAI API error:', response.status, await response.text());
      return json({ hypothesis: fallback(), usedFallback: true });
    }

    const data: any = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error('[functions] No content returned from OpenAI.');
      return json({ hypothesis: fallback(), usedFallback: true });
    }

    return json({ hypothesis: content, usedFallback: false });
  } catch (error) {
    console.error('[functions] Error generating hypothesis:', error);
    return json({
      hypothesis:
        'My working hypothesis is that being consistent with my chosen activities will help me move toward my outcome.',
      usedFallback: true,
    });
  }
}
