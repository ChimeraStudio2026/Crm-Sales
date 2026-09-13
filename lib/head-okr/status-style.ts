export function resolveHeadOkrStatusClassName(status: string): string {
  const normalizedStatus = status.trim().toLowerCase();
  if (normalizedStatus === 'done') return 'head-okr-status--done';
  if (normalizedStatus === 'in progress') return 'head-okr-status--progress';
  if (normalizedStatus === 'blocked') return 'head-okr-status--blocked';
  return 'head-okr-status--pending';
}

export function resolveHeadOkrRowClassName(status: string): string {
  const normalizedStatus = status.trim().toLowerCase();
  if (normalizedStatus === 'done') return 'head-okr-row--done';
  if (normalizedStatus === 'in progress') return 'head-okr-row--progress';
  if (normalizedStatus === 'blocked') return 'head-okr-row--blocked';
  return '';
}

export function resolveHeadOkrValueLabelClassName(valueLabel: string): string {
  const normalizedValue = valueLabel.trim().toLowerCase();
  if (normalizedValue === 'necessario') return 'head-okr-value--required';
  if (normalizedValue === 'secondario') return 'head-okr-value--secondary';
  return '';
}
