'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';

interface CampaignTableActionsProps {
  manageHref: string;
  manageLabel: string;
  onDelete: () => void;
}

export function CampaignTableActions({
  manageHref,
  manageLabel,
  onDelete,
}: CampaignTableActionsProps) {
  return (
    <div className="table-row-actions mail-campaign-row-actions">
      <Link href={manageHref} className="btn btn-secondary btn-sm">
        {manageLabel}
      </Link>
      <button
        type="button"
        className="btn-table-action delete"
        title="Elimina campagna"
        onClick={onDelete}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
