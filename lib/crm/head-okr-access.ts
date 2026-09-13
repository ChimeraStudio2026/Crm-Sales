const HEAD_OKR_VIEWER_VELCICH_PATTERN = 'virginia.velcich@chimerastudioss.com';

export function normalizeUserEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

export function isHeadOkrEditorEmail(email: string | null | undefined): boolean {
  const normalizedEmail = normalizeUserEmail(email);
  if (!normalizedEmail) return false;
  return normalizedEmail.includes('jeck');
}

export function isHeadOkrViewerEmail(email: string | null | undefined): boolean {
  const normalizedEmail = normalizeUserEmail(email);
  if (!normalizedEmail) return false;
  if (isHeadOkrEditorEmail(normalizedEmail)) return true;
  return normalizedEmail === HEAD_OKR_VIEWER_VELCICH_PATTERN;
}

export function isPathHeadOkrSection(pathname: string): boolean {
  return pathname === '/okr' || pathname.startsWith('/okr/');
}

export function filterHeadOkrProgramsForViewer<T extends { headName: string }>(
  programs: T[],
  email: string | null | undefined,
): T[] {
  if (isHeadOkrEditorEmail(email)) return programs;
  const normalizedEmail = normalizeUserEmail(email);
  if (normalizedEmail === HEAD_OKR_VIEWER_VELCICH_PATTERN) {
    return programs.filter((program) => {
      const headName = program.headName.toLowerCase();
      return headName.includes('velcich') || headName.includes('virginia');
    });
  }
  return [];
}
