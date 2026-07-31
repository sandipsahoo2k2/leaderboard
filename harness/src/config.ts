/** Loads and validates config/models.yaml. Fails loud on a typo. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import type { AppConfig } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '../..');

const slugBlock = z.object({ slug: z.string().min(1) });

const modelSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    creator: z.string().min(1),
    openWeights: z.boolean().default(false),
    contextWindow: z.number().int().positive().nullable().default(null),
    enabled: z.boolean().default(true),
    openrouter: slugBlock.optional(),
    artificialAnalysis: slugBlock.optional(),
  })
  .refine((m) => m.openrouter ?? m.artificialAnalysis, {
    message: 'model needs at least one of `openrouter` or `artificialAnalysis`',
  });

const configSchema = z.object({
  defaults: z
    .object({
      trials: z.number().int().min(1).max(25).default(5),
      temperature: z.number().min(0).max(2).default(0),
      maxTokens: z.number().int().positive().default(512),
    })
    .default({ trials: 5, temperature: 0, maxTokens: 512 }),
  models: z.array(modelSchema).min(1),
});

export function loadConfig(path = resolve(REPO_ROOT, 'config/models.yaml')): AppConfig {
  const parsed = configSchema.safeParse(parse(readFileSync(path, 'utf8')));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid ${path}:\n${detail}`);
  }

  const keys = new Set<string>();
  for (const m of parsed.data.models) {
    if (keys.has(m.key)) throw new Error(`Duplicate model key "${m.key}" in ${path}`);
    keys.add(m.key);
  }
  return parsed.data;
}

/** Models we are actually asked to work with, honouring `enabled` and `--models`. */
export function selectModels(config: AppConfig, only?: string[]) {
  const enabled = config.models.filter((m) => m.enabled);
  if (!only?.length) return enabled;

  const wanted = new Set(only);
  const picked = enabled.filter((m) => wanted.has(m.key));
  const missing = only.filter((k) => !picked.some((m) => m.key === k));
  if (missing.length) {
    throw new Error(
      `Unknown or disabled model key(s): ${missing.join(', ')}\n` +
        `Available: ${enabled.map((m) => m.key).join(', ')}`,
    );
  }
  return picked;
}
