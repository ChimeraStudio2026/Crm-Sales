import { CLIENT_ORIGIN_CHIP_CLASSES } from '@/lib/constants/crm';
import type { ClientOrigin } from '@/lib/types/crm';

export function getClientOriginCellClass(origin: ClientOrigin | ''): string {
  if (!origin) return 'cell-origin-empty';
  return CLIENT_ORIGIN_CHIP_CLASSES[origin];
}

export function isClientOrigin(value: unknown): value is ClientOrigin {
  return typeof value === 'string' && value in CLIENT_ORIGIN_CHIP_CLASSES;
}
