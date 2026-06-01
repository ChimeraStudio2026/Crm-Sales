import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export type JonnyProvider = 'anthropic' | 'openai';

function resolveProvider(): JonnyProvider | null {
  const configured = (process.env.JONNY_PROVIDER || '').toLowerCase();
  if (configured === 'anthropic' || configured === 'openai') {
    return configured;
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return 'anthropic';
  }
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  return null;
}

export function getJonnyModel(): LanguageModel {
  const provider = resolveProvider();
  if (!provider) {
    throw new Error('Nessuna API AI configurata (ANTHROPIC_API_KEY o OPENAI_API_KEY)');
  }
  const modelId = process.env.JONNY_MODEL
    || (provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL);
  if (provider === 'anthropic') {
    return anthropic(modelId);
  }
  return openai(modelId);
}

export function isJonnyConfigured(): boolean {
  return resolveProvider() !== null;
}

export function getJonnyConfigHint(): string {
  const provider = resolveProvider();
  if (provider === 'anthropic') {
    return 'ANTHROPIC_API_KEY configurata (Claude)';
  }
  if (provider === 'openai') {
    return 'OPENAI_API_KEY configurata (OpenAI)';
  }
  return 'Aggiungi ANTHROPIC_API_KEY (Claude) o OPENAI_API_KEY in .env.local';
}
