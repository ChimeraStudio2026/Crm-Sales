import { normalizeOwnerDisplay } from '@/lib/crm/owners';

const CAMPAIGN_OWNER_TAG_REGEX = /\n?<!--crm-campaign-owner:([\s\S]*?)-->$/;

export function extractCampaignOwnerFromDescription(description: string): {
  description: string;
  owner: string;
} {
  const match = description.match(CAMPAIGN_OWNER_TAG_REGEX);
  if (!match) {
    return { description, owner: '' };
  }
  return {
    description: description.replace(CAMPAIGN_OWNER_TAG_REGEX, '').trimEnd(),
    owner: match[1].trim(),
  };
}

export function embedCampaignOwnerInDescription(description: string, owner: string): string {
  const { description: cleanDescription } = extractCampaignOwnerFromDescription(description);
  if (!owner) return cleanDescription;
  const suffix = cleanDescription ? '\n' : '';
  return `${cleanDescription}${suffix}<!--crm-campaign-owner:${owner}-->`;
}

export function resolveCampaignOwner(
  ownerColumn: string | null | undefined,
  description: string,
): { description: string; owner: string } {
  const fromDescription = extractCampaignOwnerFromDescription(description);
  const rawOwner = (ownerColumn || '').trim() || fromDescription.owner;
  return {
    description: fromDescription.description,
    owner: normalizeOwnerDisplay(rawOwner),
  };
}
