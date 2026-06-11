'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { getFunnelEntriesForClient } from '@/lib/commercial-funnel/campaigns';
import { isFunnelTerminalLost, resolveFunnelStatus } from '@/lib/commercial-funnel/index';
import { formatActionDateDisplay } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';

interface ClientMailCampaignsTabProps {
  clientId: string;
}

export function ClientMailCampaignsTab({ clientId }: ClientMailCampaignsTabProps) {
  const { mailCampaigns, commercialFunnelEntries } = useCrm();

  const rows = useMemo(() => {
    const entries = getFunnelEntriesForClient(commercialFunnelEntries, clientId);
    return entries.map((entry) => {
      const campaign = mailCampaigns.find((item) => item.id === entry.campaignId);
      const status = resolveFunnelStatus(entry.actions);
      return {
        entry,
        campaign,
        status,
        isLost: isFunnelTerminalLost(entry),
      };
    });
  }, [clientId, commercialFunnelEntries, mailCampaigns]);

  if (rows.length === 0) {
    return (
      <p className="client-campaigns-empty">
        Nessuna campagna funnel per questo cliente.
      </p>
    );
  }

  return (
    <div className="client-campaigns-tab">
      <table className="analysis-table client-campaigns-table">
        <thead>
          <tr>
            <th>Campagna</th>
            <th>Status funnel</th>
            <th>Data ultima azione</th>
            <th>Stato</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entry, campaign, status, isLost }) => (
            <tr key={entry.id}>
              <td><strong>{campaign?.name || 'Campagna'}</strong></td>
              <td>{status.label}</td>
              <td>{status.date ? formatActionDateDisplay(status.date) : '—'}</td>
              <td>{isLost ? 'Perso' : 'In corso'}</td>
              <td>
                {campaign && (
                  <Link href={`/funnel/${campaign.id}`} className="btn btn-secondary btn-sm">
                    Apri campagna
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
