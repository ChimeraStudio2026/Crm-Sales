import { getClientOriginsForWorkspace } from '@/lib/crm/workspace-clients';
import { getClientOriginCellClass } from '@/lib/crm/client-origin';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';
import type { ClientOrigin } from '@/lib/types/crm';

interface ClientOriginSelectProps {
  readonly value: ClientOrigin | '';
  readonly onChange: (value: ClientOrigin | '') => void;
  readonly workspaceId?: string;
}

export function ClientOriginSelect({ value, onChange, workspaceId = DEFAULT_WORKSPACE_ID }: ClientOriginSelectProps) {
  const origins = getClientOriginsForWorkspace(workspaceId);
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
        {origins.map((origin) => (
          <option key={origin} value={origin}>{origin}</option>
        ))}
      </select>
    </div>
  );
}
