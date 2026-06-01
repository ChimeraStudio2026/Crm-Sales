import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from 'ai';
import { createCrmTools } from '@/lib/jonny/create-crm-tools';
import { getJonnyConfigHint, getJonnyModel, isJonnyConfigured } from '@/lib/jonny/get-model';
import { JONNY_SYSTEM_PROMPT } from '@/lib/jonny/system-prompt';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const maxDuration = 60;

interface ChatRequestBody {
  messages: UIMessage[];
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Non autenticato' }, { status: 401 });
  }
  if (!isJonnyConfigured()) {
    return Response.json(
      { error: `Jonny non configurato. ${getJonnyConfigHint()}` },
      { status: 503 },
    );
  }
  const body = (await request.json()) as ChatRequestBody;
  const tools = createCrmTools(supabase);
  const result = streamText({
    model: getJonnyModel(),
    system: JONNY_SYSTEM_PROMPT,
    messages: await convertToModelMessages(body.messages),
    tools,
    stopWhen: stepCountIs(8),
  });
  return result.toUIMessageStreamResponse();
}
