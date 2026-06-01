import { openai } from '@ai-sdk/openai';

const DEFAULT_JONNY_MODEL = 'gpt-4o-mini';

export function getJonnyModel(): ReturnType<typeof openai> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY non configurata');
  }
  const modelId = process.env.JONNY_MODEL || DEFAULT_JONNY_MODEL;
  return openai(modelId);
}

export function isJonnyConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
