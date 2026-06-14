'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { MailCampaign } from '@/lib/types/mail-campaigns';

interface CampaignNameCellProps {
  campaign: MailCampaign;
  onSaveName: (campaignId: string, name: string) => Promise<void>;
}

export function CampaignNameCell({ campaign, onSaveName }: CampaignNameCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(campaign.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(campaign.name);
  }, [campaign.id, campaign.name]);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const cancelEdit = (): void => {
    setName(campaign.name);
    setIsEditing(false);
  };

  const commitEdit = async (): Promise<void> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      cancelEdit();
      return;
    }
    if (trimmedName === campaign.name.trim()) {
      setIsEditing(false);
      return;
    }
    await onSaveName(campaign.id, trimmedName);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        className="form-input campaign-name-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => void commitEdit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commitEdit();
          }
          if (event.key === 'Escape') cancelEdit();
        }}
        aria-label="Nome campagna"
      />
    );
  }

  return (
    <div className="campaign-name-cell">
      <strong>{campaign.name}</strong>
      <button
        type="button"
        className="btn-table-action edit campaign-name-edit"
        title="Modifica nome"
        onClick={() => setIsEditing(true)}
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}
