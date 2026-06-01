const APOLLO_DESCRIPTION_MARKER = '--- Apollo ---';

export function appendApolloDescription(
  existingDescription: string,
  apolloDescription: string,
): string {
  if (!apolloDescription.trim()) {
    return existingDescription || '';
  }
  if (existingDescription.includes(APOLLO_DESCRIPTION_MARKER)) {
    const base = existingDescription.split(APOLLO_DESCRIPTION_MARKER)[0].trim();
    return `${base}\n\n${APOLLO_DESCRIPTION_MARKER}\n${apolloDescription.trim()}`.trim();
  }
  if (!existingDescription.trim()) {
    return `${APOLLO_DESCRIPTION_MARKER}\n${apolloDescription.trim()}`;
  }
  return `${existingDescription.trim()}\n\n${APOLLO_DESCRIPTION_MARKER}\n${apolloDescription.trim()}`;
}

export function resolveActionWithWebsite(
  currentAction: string,
  website: string | undefined,
): string {
  const trimmedAction = (currentAction || '').trim();
  const trimmedWebsite = (website || '').trim();
  if (!trimmedWebsite) {
    return trimmedAction;
  }
  if (!trimmedAction || trimmedAction === '-') {
    return trimmedWebsite;
  }
  return trimmedAction;
}
