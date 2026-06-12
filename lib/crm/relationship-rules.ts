import type { Client, Relationship } from '@/lib/types/crm';
import { RECURRENT_REV_THRESHOLD, TOP_20_REV_THRESHOLD } from '@/lib/constants/crm';

export { RECURRENT_REV_THRESHOLD, TOP_20_REV_THRESHOLD } from '@/lib/constants/crm';

export const RELATIONSHIP_INDEX: Record<Relationship, number | null> = {
  'Nuovo Cliente': 1,
  Ricorrente: 2,
  'Top 20%': 3,
  Perso: null,
  Eliminato: null,
};

export const RELATIONSHIP_STARS: Record<Relationship, string> = {
  'Nuovo Cliente': '⭐',
  Ricorrente: '⭐⭐',
  'Top 20%': '⭐⭐⭐',
  Perso: '—',
  Eliminato: '—',
};

export function isManualOnlyRelationship(relationship: Relationship): boolean {
  return relationship === 'Perso' || relationship === 'Eliminato';
}

export function resolveAutoRelationship(revenue2026: number): Relationship {
  const revenue = Number(revenue2026) || 0;
  if (revenue >= TOP_20_REV_THRESHOLD) return 'Top 20%';
  if (revenue >= RECURRENT_REV_THRESHOLD) return 'Ricorrente';
  return 'Nuovo Cliente';
}

export function isManualRelationshipLocked(client: Client): boolean {
  return client.manualRelationship || isManualOnlyRelationship(client.relationship);
}

export function getRelationshipIndex(relationship: Relationship): number {
  return RELATIONSHIP_INDEX[relationship] ?? 99;
}

export function getRelationshipStars(relationship: Relationship): string {
  return RELATIONSHIP_STARS[relationship];
}

export function applyAutoRelationships(clients: Client[]): Client[] {
  return clients.map((client) => {
    if (isManualRelationshipLocked(client)) {
      return client;
    }
    return {
      ...client,
      relationship: resolveAutoRelationship(client.rev2026),
    };
  });
}
