import { getApiBase } from '@/lib/apiBase';

export type HypothesisResult = { hypothesis: string; usedFallback: boolean };

export async function generateHypothesis(
  outcome: string,
  activities: string[],
): Promise<HypothesisResult> {
  const trimmedOutcome = outcome.trim();
  const filteredActivities = activities.map((a) => a.trim()).filter(Boolean);

  if (!trimmedOutcome || filteredActivities.length === 0) {
    throw new Error('Outcome and at least one activity are required to generate a hypothesis.');
  }

  const fallbackText = () =>
    `My working hypothesis is that regularly ${filteredActivities.join(
      ', ',
    )} will help me ${trimmedOutcome}.`;

  const baseUrl = getApiBase();

  if (baseUrl === null) {
    console.warn('[LLM] No backend base URL. Start the server with: npm run server');
    return { hypothesis: fallbackText(), usedFallback: true };
  }

  try {
    const url = `${baseUrl}/hypothesis`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outcome: trimmedOutcome,
        activities: filteredActivities,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn('[LLM] Backend error', response.status, body);
      return { hypothesis: fallbackText(), usedFallback: true };
    }

    const data = (await response.json()) as {
      hypothesis?: string;
      usedFallback?: boolean;
    };

    const content = data.hypothesis?.trim();
    if (!content) {
      console.warn('[LLM] No hypothesis in response');
      return { hypothesis: fallbackText(), usedFallback: true };
    }

    return { hypothesis: content, usedFallback: data.usedFallback === true };
  } catch (error) {
    console.warn('[LLM] Request failed (is the server running?).', error);
    return { hypothesis: fallbackText(), usedFallback: true };
  }
}