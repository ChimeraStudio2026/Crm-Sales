import { resolveCanonicalClientBrandName } from '@/lib/crm/client-brand-aliases';
import type { Client } from '@/lib/types/crm';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Nome cliente confrontabile con il campo «cliente» delle proposte Cerbero. */
export function normalizeClientKey(name: string): string {
  return resolveCanonicalClientBrandName(name.trim().replace(/\s+/g, ' ')).toLowerCase();
}

export function toDay(value: string | null | undefined): string {
  return (value || '').slice(0, 10);
}

export function dayTime(day: string): number {
  return new Date(`${day}T00:00:00`).getTime();
}

export function addDays(day: string, days: number): string {
  const date = new Date(dayTime(day) + days * DAY_MS);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${dayOfMonth}`;
}

export function daysBetween(fromDay: string, toDayValue: string): number {
  return Math.round((dayTime(toDayValue) - dayTime(fromDay)) / DAY_MS);
}

/** Cliente principale con le sue ragioni sociali: per i reminder conta come un solo cliente. */
export function getClientGroup(client: Client, clients: Client[]): Client[] {
  return [client, ...clients.filter((item) => item.parentClientId === client.id)];
}

/** Chiavi nome del gruppo (nomi + alias) per trovare le sue proposte. */
export function getClientGroupKeys(group: Client[], aliasesByClientId: ReadonlyMap<string, string[]>): Set<string> {
  return new Set([
    ...group.map((item) => item.name),
    ...group.flatMap((item) => aliasesByClientId.get(item.id) || []),
  ].map(normalizeClientKey));
}
