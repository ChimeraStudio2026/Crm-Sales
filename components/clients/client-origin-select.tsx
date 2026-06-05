import { CLIENT_ORIGINS } from '@/lib/constants/crm';
import { getClientOriginCellClass } from '@/lib/crm/client-origin';
import type { ClientOrigin } from '@/lib/types/crm';

interface ClientOriginSelectProps {
  readonly value: ClientOrigin | '';
  readonly onChange: (value: ClientOrigin | '') => void;
}

export function ClientOriginSelect({ value, onChange }: ClientOriginSelectProps) {
  const chipClass = getClientOriginCellClass(value);
  return (
    <div className={`table-cell-chip ${chipClass}`}>
      <select
        className="table-cell-select"
        value={value}
        onChange={(event) => onChange(event.target.value as ClientOrigin | '')}
        aria-label="Origine cliente"
      >
        <option value="">Seleziona origine</option>
        {CLIENT_ORIGINS.map((origin) => (
          <option key={origin} value={origin}>{origin}</option>
        ))}
      </select>
    </div>
  );
}
