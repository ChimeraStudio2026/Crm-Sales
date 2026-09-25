import type { Owner } from '@/lib/types/crm';

export const OWNER_VIRGINIA_VELCICH = 'Virginia Velcich' as const;
export const OWNER_JECK_SCARDY = 'Jeck Scardy' as const;
export const OWNER_MARTINA_GAVAZZI = 'Martina Gavazzi' as const;
export const OWNER_MARTINO = 'Martino' as const;

export const CHIMERA_OWNERS: readonly Owner[] = [
  OWNER_JECK_SCARDY,
  OWNER_VIRGINIA_VELCICH,
  OWNER_MARTINA_GAVAZZI,
];

export const ALL_OWNERS: readonly Owner[] = [
  ...CHIMERA_OWNERS,
  OWNER_MARTINO,
];

const LEGACY_OWNER_ALIASES: Record<string, Owner> = {
  Jeck: OWNER_JECK_SCARDY,
  Virgi: OWNER_VIRGINIA_VELCICH,
  Virginia: OWNER_VIRGINIA_VELCICH,
  Martina: OWNER_MARTINA_GAVAZZI,
  [OWNER_JECK_SCARDY]: OWNER_JECK_SCARDY,
  [OWNER_VIRGINIA_VELCICH]: OWNER_VIRGINIA_VELCICH,
  [OWNER_MARTINA_GAVAZZI]: OWNER_MARTINA_GAVAZZI,
  [OWNER_MARTINO]: OWNER_MARTINO,
};

export function normalizeOwner(value: unknown): Owner | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const canonical = LEGACY_OWNER_ALIASES[trimmed];
  if (canonical) return canonical;
  if (ALL_OWNERS.includes(trimmed as Owner)) return trimmed as Owner;
  return null;
}

export function isOwnerValue(value: unknown): value is Owner {
  return normalizeOwner(value) !== null;
}

export function resolveOwnerChipClassName(owner: string): string {
  const normalized = normalizeOwner(owner);
  if (normalized === OWNER_JECK_SCARDY) return 'cell-owner-jeck';
  if (normalized === OWNER_VIRGINIA_VELCICH) return 'cell-owner-virgi';
  if (normalized === OWNER_MARTINA_GAVAZZI) return 'cell-owner-martina';
  if (normalized === OWNER_MARTINO) return 'cell-origin-martino';
  return 'cell-owner';
}

export function normalizeOwnerList(values: unknown[]): Owner[] {
  return values
    .map((value) => normalizeOwner(value))
    .filter((value): value is Owner => value !== null);
}

export function normalizeOwnerDisplay(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return normalizeOwner(trimmed) ?? trimmed;
}
