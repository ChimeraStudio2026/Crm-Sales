'use client';

import { useMemo, useState } from 'react';
import { FilterX, PlusCircle, Sparkles, Trash2, User } from 'lucide-react';
import { TopHeader } from '@/components/layout/top-header';
import { ClientSearchSelect } from '@/components/clients/client-search-select';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { isClientInWorkspace } from '@/lib/crm/workspace-access';
import { getOwnersForWorkspace } from '@/lib/crm/workspace-clients';
import { formatCurrency, getTodayString, isClientInActiveSection, isClientInColdSection } from '@/lib/crm/utils';
import {
  CREATIVE_PROPOSAL_STAGES,
  SPECIAL_DISCOUNT_TYPES,
} from '@/lib/types/propositivita';
import type { CreativeProposal, CreativeProposalStage, SpecialDiscountType } from '@/lib/types/propositivita';
import {
  CREATIVE_PROPOSAL_STAGE_LABELS,
  SPECIAL_DISCOUNT_TYPE_LABELS,
  filterCreativeProposalsByWorkspace,
  filterSpecialDiscountsByWorkspace,
  getCreativeProposalIdleDays,
  getCreativeStageBadgeClass,
  getDiscountTypeBadgeClass,
  getNextCreativeProposalStage,
  getStaleCreativeProposals,
} from '@/lib/propositivita/index';

const STALE_DAY_OPTIONS = [0, 7, 15, 30] as const;

interface CreativeProposalCardProps {
  proposal: CreativeProposal;
  clientName: string;
  onStageChange: (proposalId: string, stage: CreativeProposalStage) => Promise<void>;
  onDelete: (proposalId: string) => Promise<void>;
}

function CreativeProposalCard({
  proposal,
  clientName,
  onStageChange,
  onDelete,
}: CreativeProposalCardProps) {
  const idleDays = getCreativeProposalIdleDays(proposal);
  const nextStage = getNextCreativeProposalStage(proposal.stage);
  return (
    <article className="propositivita-card glass-card">
      <div className="propositivita-card-head">
        <div>
          <strong className="propositivita-client-name">{clientName}</strong>
          <p className="propositivita-card-title">{proposal.title}</p>
        </div>
        <button
          type="button"
          className="btn-table-action"
          aria-label="Elimina creatività"
          onClick={() => {
            if (window.confirm(`Eliminare la creatività "${proposal.title}"?`)) {
              void onDelete(proposal.id);
            }
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="propositivita-card-stage-row">
        <select
          className={`propositivita-stage-select ${getCreativeStageBadgeClass(proposal.stage)}`}
          value={proposal.stage}
          onChange={(event) => {
            void onStageChange(proposal.id, event.target.value as CreativeProposalStage);
          }}
          aria-label="Stadio creatività"
        >
          {CREATIVE_PROPOSAL_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {CREATIVE_PROPOSAL_STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
        {nextStage && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void onStageChange(proposal.id, nextStage)}
          >
            Avanza
          </button>
        )}
      </div>
      <div className="propositivita-progress-wrap">
        <div className="propositivita-progress-track">
          <div
            className="propositivita-progress-fill"
            style={{ width: `${Math.min(Math.max(proposal.progressPct, 0), 100)}%` }}
          />
        </div>
        <div className="propositivita-progress-meta">
          <span className="propositivita-owner">
            <User size={14} />
            {proposal.owner || '—'}
          </span>
          <span>{proposal.progressPct}%</span>
        </div>
      </div>
      {idleDays >= 15 && (
        <p className="propositivita-stale-hint">Ferma da {idleDays} giorni</p>
      )}
    </article>
  );
}

export function PropositivitaSection() {
  const {
    clients,
    creativeProposals,
    specialDiscounts,
    createCreativeProposal,
    updateCreativeProposalStage,
    removeCreativeProposal,
    createSpecialDiscount,
    removeSpecialDiscount,
    currentOwner,
  } = useCrm();
  const { workspaceId } = useWorkspace();
  const availableOwners = useMemo(() => getOwnersForWorkspace(workspaceId), [workspaceId]);
  const workspaceClients = useMemo(
    () => clients
      .filter((client) => isClientInWorkspace(client, workspaceId))
      .sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [clients, workspaceId],
  );
  const activeClients = useMemo(
    () => clients
      .filter((client) => isClientInActiveSection(client) && isClientInWorkspace(client, workspaceId))
      .sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [clients, workspaceId],
  );
  const coldClients = useMemo(
    () => clients
      .filter((client) => isClientInColdSection(client) && isClientInWorkspace(client, workspaceId))
      .sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [clients, workspaceId],
  );
  const clientNameById = useMemo(
    () => new Map(workspaceClients.map((client) => [client.id, client.name])),
    [workspaceClients],
  );
  const [filterClientId, setFilterClientId] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterStaleDays, setFilterStaleDays] = useState<number>(0);
  const [discountFilterClientId, setDiscountFilterClientId] = useState('');
  const [discountDateFrom, setDiscountDateFrom] = useState('');
  const [discountDateTo, setDiscountDateTo] = useState('');
  const [showCreativeForm, setShowCreativeForm] = useState(false);
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [creativeClientId, setCreativeClientId] = useState('');
  const [creativeTitle, setCreativeTitle] = useState('');
  const [creativeOwner, setCreativeOwner] = useState(currentOwner || '');
  const [creativeStage, setCreativeStage] = useState<CreativeProposalStage>('idea_nata');
  const [discountClientId, setDiscountClientId] = useState('');
  const [discountType, setDiscountType] = useState<SpecialDiscountType>('sconto');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [discountDate, setDiscountDate] = useState(getTodayString());
  const [discountOwner, setDiscountOwner] = useState(currentOwner || '');

  const workspaceProposals = useMemo(
    () => filterCreativeProposalsByWorkspace(creativeProposals, workspaceId),
    [creativeProposals, workspaceId],
  );
  const workspaceDiscounts = useMemo(
    () => filterSpecialDiscountsByWorkspace(specialDiscounts, workspaceId),
    [specialDiscounts, workspaceId],
  );
  const staleCount = useMemo(
    () => getStaleCreativeProposals(workspaceProposals, 15).length,
    [workspaceProposals],
  );
  const filteredProposals = useMemo(() => {
    return workspaceProposals
      .filter((proposal) => {
        if (filterClientId && proposal.clientId !== filterClientId) return false;
        if (filterOwner && proposal.owner !== filterOwner) return false;
        if (filterStage && proposal.stage !== filterStage) return false;
        if (filterStaleDays > 0 && getCreativeProposalIdleDays(proposal) < filterStaleDays) return false;
        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [workspaceProposals, filterClientId, filterOwner, filterStage, filterStaleDays]);
  const filteredDiscounts = useMemo(() => {
    return workspaceDiscounts
      .filter((discount) => {
        if (discountFilterClientId && discount.clientId !== discountFilterClientId) return false;
        if (discountDateFrom && discount.date < discountDateFrom) return false;
        if (discountDateTo && discount.date > discountDateTo) return false;
        return true;
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [workspaceDiscounts, discountFilterClientId, discountDateFrom, discountDateTo]);

  const resetCreativeFilters = (): void => {
    setFilterClientId('');
    setFilterOwner('');
    setFilterStage('');
    setFilterStaleDays(0);
  };

  const resetDiscountFilters = (): void => {
    setDiscountFilterClientId('');
    setDiscountDateFrom('');
    setDiscountDateTo('');
  };

  const handleCreateCreative = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!creativeClientId || !creativeTitle.trim()) return;
    await createCreativeProposal({
      clientId: creativeClientId,
      workspaceId,
      title: creativeTitle,
      owner: creativeOwner,
      stage: creativeStage,
    });
    setShowCreativeForm(false);
    setCreativeClientId('');
    setCreativeTitle('');
    setCreativeStage('idea_nata');
  };

  const handleCreateDiscount = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!discountClientId || !discountAmount.trim()) return;
    await createSpecialDiscount({
      clientId: discountClientId,
      workspaceId,
      owner: discountOwner,
      type: discountType,
      amount: Number(discountAmount),
      reason: discountReason,
      date: discountDate,
    });
    setShowDiscountForm(false);
    setDiscountClientId('');
    setDiscountAmount('');
    setDiscountReason('');
    setDiscountDate(getTodayString());
  };

  const formatDiscountAmount = (type: SpecialDiscountType, amount: number): string => {
    const formatted = formatCurrency(amount);
    if (type === 'sconto') return `−${formatted}`;
    return formatted;
  };

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="propositivita-summary glass-card">
            <div>
              <h3 className="propositivita-section-title"><Sparkles size={20} /> Propositività</h3>
              <p className="propositivita-section-subtitle">
                Creatività proposte ai clienti e sconti/extra concessi nel workspace.
              </p>
            </div>
            <div className="propositivita-summary-stats">
              <span>{workspaceProposals.length} creatività</span>
              <span>{workspaceDiscounts.length} voci sconti/extra</span>
              {staleCount > 0 && <span className="is-warning">{staleCount} ferme da 15+ giorni</span>}
            </div>
          </div>

          <div className="propositivita-block">
            <div className="table-filter-bar">
              <div className="filter-left">
                <h4>Creatività propositive</h4>
              </div>
              <div className="filter-right">
                <button type="button" className="btn btn-primary" onClick={() => setShowCreativeForm(true)}>
                  <PlusCircle size={16} />
                  <span>Nuova creatività</span>
                </button>
              </div>
            </div>
            <div className="table-filter-bar propositivita-filters">
              <div className="filter-left">
                <select className="form-select" value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)}>
                  <option value="">Tutti i clienti</option>
                  {workspaceClients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
                <select className="form-select" value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
                  <option value="">Tutti gli owner</option>
                  {availableOwners.map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
                <select className="form-select" value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
                  <option value="">Tutti gli stadi</option>
                  {CREATIVE_PROPOSAL_STAGES.map((stage) => (
                    <option key={stage} value={stage}>{CREATIVE_PROPOSAL_STAGE_LABELS[stage]}</option>
                  ))}
                </select>
                <select
                  className="form-select"
                  value={String(filterStaleDays)}
                  onChange={(e) => setFilterStaleDays(Number(e.target.value))}
                >
                  {STALE_DAY_OPTIONS.map((days) => (
                    <option key={days} value={days}>
                      {days === 0 ? 'Qualsiasi inattività' : `Ferme da ${days}+ giorni`}
                    </option>
                  ))}
                </select>
                {(filterClientId || filterOwner || filterStage || filterStaleDays > 0) && (
                  <button type="button" className="btn btn-secondary" onClick={resetCreativeFilters}>
                    <FilterX size={14} />
                    Reset
                  </button>
                )}
              </div>
            </div>
            {filteredProposals.length === 0 ? (
              <div className="glass-card propositivita-empty">Nessuna creatività trovata.</div>
            ) : (
              <div className="propositivita-grid">
                {filteredProposals.map((proposal) => (
                  <CreativeProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    clientName={clientNameById.get(proposal.clientId) || 'Cliente sconosciuto'}
                    onStageChange={(proposalId, stage) => updateCreativeProposalStage(proposalId, stage)}
                    onDelete={removeCreativeProposal}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="propositivita-block">
            <div className="table-filter-bar">
              <div className="filter-left">
                <h4>Sconti ed extra</h4>
              </div>
              <div className="filter-right">
                <button type="button" className="btn btn-primary" onClick={() => setShowDiscountForm(true)}>
                  <PlusCircle size={16} />
                  <span>Registra voce</span>
                </button>
              </div>
            </div>
            <div className="table-filter-bar propositivita-filters">
              <div className="filter-left">
                <select
                  className="form-select"
                  value={discountFilterClientId}
                  onChange={(e) => setDiscountFilterClientId(e.target.value)}
                >
                  <option value="">Tutti i clienti</option>
                  {workspaceClients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
                <input
                  type="date"
                  className="form-input"
                  value={discountDateFrom}
                  onChange={(e) => setDiscountDateFrom(e.target.value)}
                  aria-label="Data da"
                />
                <input
                  type="date"
                  className="form-input"
                  value={discountDateTo}
                  onChange={(e) => setDiscountDateTo(e.target.value)}
                  aria-label="Data a"
                />
                {(discountFilterClientId || discountDateFrom || discountDateTo) && (
                  <button type="button" className="btn btn-secondary" onClick={resetDiscountFilters}>
                    <FilterX size={14} />
                    Reset
                  </button>
                )}
              </div>
            </div>
            <div className="glass-card propositivita-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Motivo</th>
                    <th>Valore</th>
                    <th>Data</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredDiscounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table-empty">Nessuna voce registrata.</td>
                    </tr>
                  ) : (
                    filteredDiscounts.map((discount) => (
                      <tr key={discount.id}>
                        <td>{clientNameById.get(discount.clientId) || 'Cliente sconosciuto'}</td>
                        <td>
                          <span className={getDiscountTypeBadgeClass(discount.type)}>
                            {SPECIAL_DISCOUNT_TYPE_LABELS[discount.type]}
                          </span>
                        </td>
                        <td>{discount.reason || '—'}</td>
                        <td>
                          <span className={discount.type === 'sconto' ? 'propositivita-amount is-discount' : 'propositivita-amount is-extra'}>
                            {formatDiscountAmount(discount.type, discount.amount)}
                          </span>
                        </td>
                        <td>{discount.date}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-table-action"
                            aria-label="Elimina voce"
                            onClick={() => {
                              if (window.confirm('Eliminare questa voce?')) {
                                void removeSpecialDiscount(discount.id);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {showCreativeForm && (
        <>
          <div className="drawer-overlay open" onClick={() => setShowCreativeForm(false)} />
          <div className="drawer open">
            <div className="drawer-header"><h3>Nuova creatività</h3></div>
            <form onSubmit={(event) => void handleCreateCreative(event)}>
              <div className="drawer-body">
                <label className="form-label">
                  Cliente
                  <ClientSearchSelect
                    activeClients={activeClients}
                    coldClients={coldClients}
                    value={creativeClientId}
                    onChange={setCreativeClientId}
                    required
                    placeholder="Cerca cliente per nome..."
                  />
                </label>
                <label className="form-label">
                  Titolo
                  <input className="form-input" value={creativeTitle} onChange={(e) => setCreativeTitle(e.target.value)} required />
                </label>
                <label className="form-label">
                  Owner
                  <select className="form-select" value={creativeOwner} onChange={(e) => setCreativeOwner(e.target.value)}>
                    <option value="">—</option>
                    {availableOwners.map((owner) => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Stadio iniziale
                  <select
                    className="form-select"
                    value={creativeStage}
                    onChange={(e) => setCreativeStage(e.target.value as CreativeProposalStage)}
                  >
                    {CREATIVE_PROPOSAL_STAGES.map((stage) => (
                      <option key={stage} value={stage}>{CREATIVE_PROPOSAL_STAGE_LABELS[stage]}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="drawer-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreativeForm(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">Salva</button>
              </div>
            </form>
          </div>
        </>
      )}

      {showDiscountForm && (
        <>
          <div className="drawer-overlay open" onClick={() => setShowDiscountForm(false)} />
          <div className="drawer open">
            <div className="drawer-header"><h3>Registra voce</h3></div>
            <form onSubmit={(event) => void handleCreateDiscount(event)}>
              <div className="drawer-body">
                <label className="form-label">
                  Cliente
                  <select className="form-select" value={discountClientId} onChange={(e) => setDiscountClientId(e.target.value)} required>
                    <option value="">Seleziona cliente</option>
                    {workspaceClients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Tipo
                  <select
                    className="form-select"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as SpecialDiscountType)}
                  >
                    {SPECIAL_DISCOUNT_TYPES.map((type) => (
                      <option key={type} value={type}>{SPECIAL_DISCOUNT_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Importo
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    required
                  />
                </label>
                <label className="form-label">
                  Motivo
                  <input className="form-input" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
                </label>
                <label className="form-label">
                  Data
                  <input className="form-input" type="date" value={discountDate} onChange={(e) => setDiscountDate(e.target.value)} required />
                </label>
                <label className="form-label">
                  Owner
                  <select className="form-select" value={discountOwner} onChange={(e) => setDiscountOwner(e.target.value)}>
                    <option value="">—</option>
                    {availableOwners.map((owner) => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="drawer-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDiscountForm(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">Salva</button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
