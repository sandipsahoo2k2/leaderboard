/**
 * OpenRouter = the thing we MEASURE with. One OpenAI-compatible endpoint for
 * every model, so adding a model never means adding an adapter.
 *
 * Streaming is mandatory here: time-to-first-token only exists if we stream.
 */

import OpenAI from 'openai';
import type { StreamSample } from '../types.ts';

const BASE_URL = 'https://openrouter.ai/api/v1';

export interface CompleteOptions {
  temperature: number;
  maxTokens: number;
}

export class OpenRouterClient {
  private readonly api: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
    this.api = new OpenAI({
      apiKey,
      baseURL: BASE_URL,
      defaultHeaders: { 'X-Title': 'oss-model-leaderboard' },
    });
  }

  /**
   * One streamed completion, instrumented.
   *
   * ttftMs  = request sent -> first chunk carrying visible content
   * totalMs = request sent -> stream closed
   * Token counts come from the provider's usage block, not a local estimate.
   */
  async complete(
    slug: string,
    prompt: string,
    opts: CompleteOptions,
  ): Promise<StreamSample> {
    const startedAt = performance.now();
    let ttftMs = -1;
    let text = '';
    let completionTokens = 0;
    let promptTokens = 0;

    const stream = await this.api.chat.completions.create({
      model: slug,
      messages: [{ role: 'user', content: prompt }],
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta && ttftMs < 0) ttftMs = performance.now() - startedAt;
      text += delta;

      if (chunk.usage) {
        completionTokens = chunk.usage.completion_tokens ?? 0;
        promptTokens = chunk.usage.prompt_tokens ?? 0;
      }
    }

    const totalMs = performance.now() - startedAt;
    if (ttftMs < 0) ttftMs = totalMs; // stream produced no visible content

    // Fall back to a rough count only if the provider withheld usage, so a
    // missing usage block degrades the number instead of zeroing it.
    if (completionTokens === 0 && text.length > 0) {
      completionTokens = Math.max(1, Math.round(text.length / 4));
    }

    return { ttftMs, totalMs, completionTokens, promptTokens, text };
  }

  /** Public, unauthenticated. Used to catch bad slugs before spending tokens. */
  async listSlugs(): Promise<string[]> {
    const res = await fetch(`${BASE_URL}/models`);
    if (!res.ok) throw new Error(`OpenRouter /models failed: ${res.status} ${res.statusText}`);
    const body = (await res.json()) as { data?: Array<{ id?: string }> };
    return (body.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
  }
}

/** Cheap similarity so a bad slug gets a useful suggestion instead of a 404. */
export function nearestSlugs(wanted: string, available: string[], limit = 5): string[] {
  const needle = wanted.toLowerCase();
  const tokens = needle.split(/[/\-_.]/).filter((t) => t.length > 2);

  return available
    .map((slug) => {
      const hay = slug.toLowerCase();
      let score = 0;
      if (hay.includes(needle)) score += 100;
      for (const t of tokens) if (hay.includes(t)) score += t.length;
      return { slug, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => c.slug);
}
