import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { NextResponse } from 'next/server';
import * as z from 'zod/v4';
import { QUOTE_ASSISTANT_SYSTEM_PROMPT } from '@/lib/quotes/assistant-prompt';
import { AssistantQuoteSchema } from '@/lib/quotes/assistant-schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
// Una bozza completa può richiedere più di un minuto.
export const maxDuration = 300;

const MODEL = 'claude-opus-5-5';

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(20000),
  draft: AssistantQuoteSchema.shape.quote,
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(40),
});

let client: Anthropic | null = null;

function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato.' }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY non configurata: aggiungila nelle variabili d\'ambiente di Vercel.' },
      { status: 500 },
    );
  }

  const parsedBody = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }
  const { message, draft, history } = parsedBody.data;

  // La bozza viaggia con l'ultimo messaggio: lo storico resta solo testo, così
  // le modifiche fatte a mano in tabella arrivano sempre a Claude.
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((entry) => ({ role: entry.role, content: entry.content })),
    {
      role: 'user',
      content: `Bozza attuale del preventivo (JSON):\n${JSON.stringify(draft)}\n\nRichiesta del commerciale:\n${message}`,
    },
  ];

  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: QUOTE_ASSISTANT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'medium', format: betaZodOutputFormat(AssistantQuoteSchema) },
      messages,
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: 'Claude non ha potuto elaborare questa richiesta. Prova a riformularla.' },
        { status: 422 },
      );
    }
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      return NextResponse.json(
        { error: 'La risposta di Claude è incompleta. Riprova o dividi la richiesta in passi più piccoli.' },
        { status: 502 },
      );
    }
    return NextResponse.json({ result: response.parsed_output });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'Chiave API di Anthropic non valida.' }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Troppe richieste a Claude: riprova tra poco.' }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Errore Claude (${error.status}): ${error.message}` }, { status: 502 });
    }
    // Errori di validazione della bozza restituita: meglio un messaggio leggibile che un 500 vuoto.
    console.error('quote assistant error', error);
    return NextResponse.json(
      { error: 'La bozza restituita da Claude non è valida. Riprova.' },
      { status: 502 },
    );
  }
}
