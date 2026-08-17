// Port of server/index.js's POST /api/weekly-plan.
// Expects: { outcome_goal, current_average_outcome?, time_constraints?, preferences?, regression_summary: { r_squared, n_days, activities } }
import type { Env } from '../_lib/env';
import { getOpenAiKey } from '../_lib/env';
import { json, preflight } from '../_lib/cors';
import { checkRateLimit, clientKey } from '../_lib/rateLimit';

export const onRequestOptions: PagesFunction<Env> = async () => preflight();

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const allowed = await checkRateLimit(env, `weekly-plan:${clientKey(request)}`);
  if (!allowed) {
    return json({ error: 'Too many requests, try again later.' }, { status: 429 });
  }

  const openAiKey = getOpenAiKey(env);
  if (!openAiKey) {
    return json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  if (
    !body ||
    !body.regression_summary ||
    !Array.isArray(body.regression_summary.activities) ||
    body.regression_summary.activities.length === 0
  ) {
    return json({ error: 'regression_summary.activities is required' }, { status: 400 });
  }

  try {
    const prompt = `You are a wellness coach. Create a 7-day activity plan.

Goal: ${body.outcome_goal}
Current average outcome: ${body.current_average_outcome || 'unknown'}

Activities and their impact (coefficient):
${body.regression_summary.activities
  .map((a: any) => `- ${a.name}: ${a.coefficient > 0 ? '+' : ''}${a.coefficient.toFixed(2)}`)
  .join('\n')}

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
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data: any = await response.json();
    const content: string = data.choices[0].message.content;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const plan = JSON.parse(jsonMatch[0]);
    return json(plan);
  } catch (err: any) {
    console.error('[functions] /api/weekly-plan error:', err);
    return json(
      { error: err.message || 'Failed to generate plan', details: err.toString() },
      { status: 502 },
    );
  }
};
