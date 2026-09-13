import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { createUniqueId } from '@/lib/crm/utils';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';
import type { HeadOkrProgram, HeadOkrProgramContent, HeadOkrProgramDraft } from '@/lib/types/head-okr';

function requireBrowserSupabaseClient(): SupabaseClient {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase non configurato.');
  }
  return supabase;
}

interface HeadOkrProgramRow {
  id: string;
  workspace_id: string;
  head_name: string;
  role_title: string;
  sheet_title: string;
  framework_label: string;
  framework_start_date: string | null;
  intro_text: string;
  content: HeadOkrProgramContent;
  created_at: string;
  updated_at: string;
}

function mapHeadOkrProgramRow(row: HeadOkrProgramRow): HeadOkrProgram {
  return {
    id: row.id,
    workspaceId: row.workspace_id || DEFAULT_WORKSPACE_ID,
    headName: row.head_name,
    roleTitle: row.role_title || '',
    sheetTitle: row.sheet_title || '',
    frameworkLabel: row.framework_label || '',
    frameworkStartDate: row.framework_start_date,
    introText: row.intro_text || '',
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchHeadOkrPrograms(workspaceId: string): Promise<HeadOkrProgram[]> {
  const supabase = requireBrowserSupabaseClient();
  const { data, error } = await supabase
    .from('head_okr_programs')
    .select('*')
    .eq('workspace_id', workspaceId || DEFAULT_WORKSPACE_ID)
    .order('head_name', { ascending: true });
  if (error) throw error;
  return (data as HeadOkrProgramRow[]).map(mapHeadOkrProgramRow);
}

export async function upsertHeadOkrProgramFromDraft(
  workspaceId: string,
  draft: HeadOkrProgramDraft,
): Promise<HeadOkrProgram> {
  const supabase = requireBrowserSupabaseClient();
  const resolvedWorkspaceId = workspaceId || DEFAULT_WORKSPACE_ID;
  const { data: existingRows, error: existingError } = await supabase
    .from('head_okr_programs')
    .select('id')
    .eq('workspace_id', resolvedWorkspaceId)
    .eq('head_name', draft.headName)
    .limit(1);
  if (existingError) throw existingError;
  const existingId = existingRows?.[0]?.id as string | undefined;
  const payload = {
    workspace_id: resolvedWorkspaceId,
    head_name: draft.headName,
    role_title: draft.roleTitle,
    sheet_title: draft.sheetTitle,
    framework_label: draft.frameworkLabel,
    framework_start_date: draft.frameworkStartDate,
    intro_text: draft.introText,
    content: draft.content,
    updated_at: new Date().toISOString(),
  };
  if (existingId) {
    const { data, error } = await supabase
      .from('head_okr_programs')
      .update(payload)
      .eq('id', existingId)
      .select('*')
      .single();
    if (error) throw error;
    return mapHeadOkrProgramRow(data as HeadOkrProgramRow);
  }
  const { data, error } = await supabase
    .from('head_okr_programs')
    .insert({
      id: createUniqueId('head-okr'),
      ...payload,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapHeadOkrProgramRow(data as HeadOkrProgramRow);
}

export async function updateHeadOkrProgramContent(
  programId: string,
  content: HeadOkrProgramContent,
): Promise<HeadOkrProgram> {
  return updateHeadOkrProgram(programId, { content });
}

export interface HeadOkrProgramUpdatePayload {
  introText?: string;
  roleTitle?: string;
  sheetTitle?: string;
  frameworkLabel?: string;
  content?: HeadOkrProgramContent;
}

export async function updateHeadOkrProgram(
  programId: string,
  payload: HeadOkrProgramUpdatePayload,
): Promise<HeadOkrProgram> {
  const supabase = requireBrowserSupabaseClient();
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.introText !== undefined) updatePayload.intro_text = payload.introText;
  if (payload.roleTitle !== undefined) updatePayload.role_title = payload.roleTitle;
  if (payload.sheetTitle !== undefined) updatePayload.sheet_title = payload.sheetTitle;
  if (payload.frameworkLabel !== undefined) updatePayload.framework_label = payload.frameworkLabel;
  if (payload.content !== undefined) updatePayload.content = payload.content;
  const { data, error } = await supabase
    .from('head_okr_programs')
    .update(updatePayload)
    .eq('id', programId)
    .select('*')
    .single();
  if (error) throw error;
  return mapHeadOkrProgramRow(data as HeadOkrProgramRow);
}
