import {
  MAIL_CAMPAIGN_STATUSES,
  MAIL_CAMPAIGN_STATUS_LABELS,
} from '@/lib/constants/mail-campaigns';
import type { MailCampaignStatus } from '@/lib/types/mail-campaigns';

interface CampaignStatusSelectProps {
  readonly value: MailCampaignStatus;
  readonly onChange: (status: MailCampaignStatus) => void;
  readonly className?: string;
}

export function CampaignStatusSelect({
  value,
  onChange,
  className = 'table-cell-select',
}: CampaignStatusSelectProps) {
  return (
    <select
      className={className}
      value={value}
      aria-label="Stato campagna"
      onChange={(event) => onChange(event.target.value as MailCampaignStatus)}
    >
      {MAIL_CAMPAIGN_STATUSES.map((status) => (
        <option key={status} value={status}>
          {MAIL_CAMPAIGN_STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  );
}
