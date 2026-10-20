'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import {
  buildFunnelCampaignDashboardRow,
  filterCampaignsByWorkspace,
  filterEntriesByVisibleCampaigns,
  filterFunnelEntriesByWorkspace,
  filterVisibleCampaigns,
  getFunnelEntriesForCampaign,
  isClosedCampaign,
} from '@/lib/commercial-funnel/campaigns';
import {
  readFunnelOwnerFilter,
  readHideClosedFunnelCampaignsPreference,
  readSalesPageViewPreference,
  writeFunnelOwnerFilter,
  writeHideClosedFunnelCampaignsPreference,
  writeSalesPageViewPreference,
} from '@/lib/commercial-funnel/preferences';
import type { SalesPageView } from '@/lib/commercial-funnel/preferences';
import { normalizeOwner } from '@/lib/crm/owners';
import { getOwnersForWorkspace } from '@/lib/crm/workspace-clients';
import { downloadCommercialFunnelExcel } from '@/lib/commercial-funnel/export';
import { buildFunnelStatsSummary } from '@/lib/commercial-funnel/stats';
import { getTodayString, isClientInColdSection } from '@/lib/crm/utils';
import { resolveWorkspaceLabel } from '@/lib/constants/workspaces';
import { FunnelStatsCharts } from '@/components/commercial-funnel/funnel-stats-charts';
import { AccountingView } from '@/components/commercial-funnel/accounting-view';
import type { NewCampaignInput, ObjectiveListCampaign } from '@/components/commercial-funnel/accounting-view';
import { FunnelClientsView } from '@/components/commercial-funnel/funnel-clients-view';
import { getNamedContacts } from '@/components/commercial-funnel/action-fields';
import { isOwner } from '@/lib/constants/crm';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { TopHeader } from '@/components/layout/top-header';
import type { FunnelClientRef } from '@/lib/types/commercial-funnel';
import type { Owner } from '@/lib/types/crm';

// Obiettivi e campagne di tutti in una lista, più i clienti delle campagne.
const SALES_PAGE_VIEWS: readonly [SalesPageView, string][] = [
  ['list', 'Lista'],
  ['clients', 'Clienti campagne'],
];

export function CommercialFunnelSection() {
  const router = useRouter();
  const {
    clients,
    mailCampaigns,
    commercialFunnelEntries,
    addClientsToFunnel,
    saveMailCampaign,
    updateMailCampaignOwner,
    deleteMailCampaignById,
  } = useCrm();
  const { workspaceId } = useWorkspace();
  const [pageView, setPageView] = useState<SalesPageView>('list');
  const [hideClosedCampaigns, setHideClosedCampaigns] = useState(true);
  const [hideClosedPreferenceReady, setHideClosedPreferenceReady] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);

  useEffect(() => {
    setHideClosedCampaigns(readHideClosedFunnelCampaignsPreference());
    setHideClosedPreferenceReady(true);
    setOwnerFilter(readFunnelOwnerFilter());
    setPageView(readSalesPageViewPreference());
  }, []);

  const changeOwnerFilter = (next: string[]): void => {
    setOwnerFilter(next);
    writeFunnelOwnerFilter(next);
  };

  const toggleOwnerFilter = (ownerName: string): void => {
    changeOwnerFilter(ownerFilter.includes(ownerName)
      ? ownerFilter.filter((item) => item !== ownerName)
      : [...ownerFilter, ownerName]);
  };

  const changePageView = (nextView: SalesPageView): void => {
    setPageView(nextView);
    writeSalesPageViewPreference(nextView);
  };

  useEffect(() => {
    if (!hideClosedPreferenceReady) return;
    writeHideClosedFunnelCampaignsPreference(hideClosedCampaigns);
  }, [hideClosedCampaigns, hideClosedPreferenceReady]);

  // Sales e Account non sono più separati: tutte le campagne del workspace in una lista.
  const scopedCampaigns = useMemo(
    () => filterCampaignsByWorkspace(mailCampaigns, workspaceId),
    [mailCampaigns, workspaceId],
  );
  const scopedEntries = useMemo(
    () => filterEntriesByVisibleCampaigns(
      filterFunnelEntriesByWorkspace(commercialFunnelEntries, workspaceId),
      new Set(scopedCampaigns.map((campaign) => campaign.id)),
    ),
    [commercialFunnelEntries, scopedCampaigns, workspaceId],
  );
  const closedCampaignCount = useMemo(
    () => scopedCampaigns.filter((campaign) => isClosedCampaign(campaign)).length,
    [scopedCampaigns],
  );
  const visibleCampaigns = useMemo(
    () => filterVisibleCampaigns(scopedCampaigns, hideClosedCampaigns),
    [hideClosedCampaigns, scopedCampaigns],
  );
  const visibleEntries = useMemo(
    () => filterEntriesByVisibleCampaigns(scopedEntries, new Set(visibleCampaigns.map((campaign) => campaign.id))),
    [scopedEntries, visibleCampaigns],
  );
  // Vista Clienti: il toggle owner filtra i clienti per owner del contatto.
  const workspaceOwners = useMemo(() => getOwnersForWorkspace(workspaceId), [workspaceId]);
  const activeOwnerFilter = useMemo(
    () => new Set(ownerFilter.filter((item) => workspaceOwners.includes(item as Owner))),
    [ownerFilter, workspaceOwners],
  );
  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const ownerEntries = useMemo(
    () => (activeOwnerFilter.size === 0
      ? visibleEntries
      : visibleEntries.filter((entry) => {
        const entryOwner = normalizeOwner(entry.owner) || normalizeOwner(clientById.get(entry.clientId)?.owner);
        return activeOwnerFilter.has(entryOwner || '');
      })),
    [activeOwnerFilter, clientById, visibleEntries],
  );
  const clientsStats = useMemo(() => buildFunnelStatsSummary(ownerEntries), [ownerEntries]);

  // Le campagne stanno nella stessa lista degli obiettivi; clienti e statistiche si vedono nella loro pagina.
  const listCampaigns = useMemo<ObjectiveListCampaign[]>(
    () => visibleCampaigns.map((campaign) => {
      const row = buildFunnelCampaignDashboardRow(campaign, scopedEntries);
      return {
        id: campaign.id,
        name: campaign.name,
        owner: campaign.owner,
        note: campaign.description,
        href: `/funnel/${campaign.id}`,
        clientNames: getFunnelEntriesForCampaign(scopedEntries, campaign.id)
          .map((entry) => clientById.get(entry.clientId)?.name || ''),
        totalClients: row.totalClients,
        activeCount: row.activeCount,
        convertedCount: row.convertedCount,
        lostCount: row.lostCount,
        redCount: row.redSemaforoCount,
        isClosed: isClosedCampaign(campaign),
      };
    }),
    [clientById, scopedEntries, visibleCampaigns],
  );

  // Dal «Nuovo» unico: stessi campi dell'obiettivo; la campagna parte attiva con i clienti scelti.
  const handleCreateCampaign = async (input: NewCampaignInput): Promise<void> => {
    const campaignId = await saveMailCampaign({
      workspaceId,
      funnelTrack: 'cold',
      name: input.name,
      description: input.note,
      status: 'Attiva',
      startDate: getTodayString(),
      endDate: '',
      owner: isOwner(input.owner) ? input.owner : '',
    });
    const refs: FunnelClientRef[] = input.clientIds.map((clientId) => {
      const client = clientById.get(clientId);
      return {
        clientId,
        contactId: getNamedContacts(client)[0]?.id || '',
        clientSource: client && isClientInColdSection(client) ? 'cold' : 'main',
      };
    });
    await addClientsToFunnel(campaignId, refs, workspaceId);
    router.push(`/funnel/${campaignId}`);
  };

  const handleCampaignOwnerChange = async (campaignId: string, nextOwner: string): Promise<void> => {
    await updateMailCampaignOwner(campaignId, isOwner(nextOwner) ? nextOwner : '');
  };

  const handleDeleteCampaign = async (campaign: ObjectiveListCampaign): Promise<void> => {
    if (!window.confirm(`Eliminare la campagna "${campaign.name}"?\n\nVerranno rimossi anche clienti e dati del funnel collegati.`)) {
      return;
    }
    await deleteMailCampaignById(campaign.id);
  };

  const handleDownloadExcel = (): void => {
    downloadCommercialFunnelExcel({
      entries: visibleEntries,
      clients,
      mailCampaigns: visibleCampaigns,
      workspaceLabel: resolveWorkspaceLabel(workspaceId),
    });
  };

  const salesViewToggle = (
    <div className="task-view-toggle" role="group" aria-label="Vista funnel">
      {SALES_PAGE_VIEWS.map(([view, label]) => (
        <button
          key={view}
          type="button"
          className={`task-view-toggle-btn${pageView === view ? ' is-active' : ''}`}
          aria-pressed={pageView === view}
          onClick={() => changePageView(view)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const closedCampaignsChip = closedCampaignCount > 0 ? (
    <button
      type="button"
      className={`clients-filter-chip ${hideClosedCampaigns ? 'is-active' : ''}`}
      onClick={() => setHideClosedCampaigns((prev) => !prev)}
      title={hideClosedCampaigns ? 'Mostra campagne chiuse' : 'Nascondi campagne chiuse'}
    >
      {hideClosedCampaigns ? 'Campagne chiuse nascoste' : 'Campagne chiuse visibili'}
      <span className="clients-filter-chip-count">{closedCampaignCount}</span>
    </button>
  ) : null;

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          {pageView === 'list' ? (
            <AccountingView
              toolbarExtra={(
                <>
                  {salesViewToggle}
                  {closedCampaignsChip}
                </>
              )}
              campaigns={listCampaigns}
              onCreateCampaign={handleCreateCampaign}
              onCampaignOwnerChange={handleCampaignOwnerChange}
              onDeleteCampaign={handleDeleteCampaign}
            />
          ) : (
            <>
              <div className="table-filter-bar">
                <div className="filter-left" />
                <div className="filter-right">
                  {salesViewToggle}
                  {closedCampaignsChip}
                  <button type="button" className="btn btn-secondary" onClick={handleDownloadExcel}>
                    <Download size={16} />
                    <span>Scarica Excel</span>
                  </button>
                </div>
              </div>
              <div className="funnel-owner-filter" role="group" aria-label="Filtra per owner">
                <span className="tasks-filter-label">Owner:</span>
                <button
                  type="button"
                  className={`clients-filter-chip${activeOwnerFilter.size === 0 ? ' is-active' : ''}`}
                  aria-pressed={activeOwnerFilter.size === 0}
                  onClick={() => changeOwnerFilter([])}
                >
                  Tutti
                </button>
                {workspaceOwners.map((ownerName) => (
                  <button
                    key={ownerName}
                    type="button"
                    className={`clients-filter-chip${activeOwnerFilter.has(ownerName) ? ' is-active' : ''}`}
                    aria-pressed={activeOwnerFilter.has(ownerName)}
                    title={`Solo i contatti di ${ownerName}`}
                    onClick={() => toggleOwnerFilter(ownerName)}
                  >
                    Solo {ownerName.split(' ')[0]}
                  </button>
                ))}
              </div>
              <FunnelStatsCharts title="Totali campagne" stats={clientsStats} />
              <FunnelClientsView
                entries={ownerEntries}
                clients={clients}
                mailCampaigns={visibleCampaigns}
                showCampaignColumn
              />
            </>
          )}
        </section>
      </div>
    </>
  );
}
