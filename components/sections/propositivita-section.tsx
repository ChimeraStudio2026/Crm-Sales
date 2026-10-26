'use client';

import { useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Edit, ExternalLink, FilterX, Mail, PlusCircle, Trash2, User, Wallet } from 'lucide-react';
import { TopHeader } from '@/components/layout/top-header';
import { ClientSearchSelect } from '@/components/clients/client-search-select';
import { CreativeStageModal } from '@/components/propositivita/creative-stage-modal';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { isClientInWorkspace, isOwnedByScope } from '@/lib/crm/workspace-access';
import { getDefaultOwnerForWorkspace, getOwnersForWorkspace } from '@/lib/crm/workspace-clients';
import { CRM_WORKSPACES, resolveClientWorkspaceIdsForCreativeCompany, resolveWorkspaceLabel, type WorkspaceId } from '@/lib/constants/workspaces';
import { formatCurrency, getTodayString, isClientInActiveSection, isClientInColdSection } from '@/lib/crm/utils';
import {
  CREATIVE_PROPOSAL_STAGES,
  SPECIAL_DISCOUNT_TYPES,
} from '@/lib/types/propositivita';
import type { CreativeProposal, CreativeProposalStage, SpecialDiscountType } from '@/lib/types/propositivita';
import {
  CREATIVE_PROPOSAL_STAGE_LABELS,
  SPECIAL_DISCOUNT_TYPE_LABELS,
  filterSpecialDiscountsByWorkspace,
  getCreativeProposalIdleDays,
  getCreativeStageBadgeClass,
  getDiscountTypeBadgeClass,
  getNextCreativeProposalStage,
  getForwardCreativeProposalStageOptions,
  getPreviousCreativeProposalStage,
  getStaleCreativeProposals,
  formatCreativeProposalDate,
  isCreativeProposalDeadlineOverdue,
  resolveCreativeProposalActionsChronological,
  resolveLastCreativeActionAt,
  getCreativeProgressFillClass,
  buildCreativeProposalsReport,
  resolveCreativeProposalBudgetTotal,
} from '@/lib/propositivita/index';
import {
  getCreativeProposalContacts,
  resolveCreativeProposalContactLabel,
} from '@/lib/propositivita/contacts';

const STALE_DAY_OPTIONS = [0, 7, 15, 30] as const;

interface StageChangeRequest {
  proposalId: string;
  nextStage: CreativeProposalStage;
  direction: 'forward' | 'backward';
}

interface CreativeProposalCardProps {
  proposal: CreativeProposal;
  clientName: string;
  contactLabel: string;
  budgetTotal: number;
  onRequestStageChange: (request: StageChangeRequest) => void;
  onAddBudget: (proposalId: string) => void;
  onEdit: (proposal: CreativeProposal) => void;
  onDelete: (proposalId: string) => Promise<void>;
}

function renderReference(reference: string): React.ReactNode {
  if (!reference.trim()) return null;
  const trimmed = reference.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);
  if (isUrl) {
    return (
      <a href={trimmed} target="_blank" rel="noreferrer" className="propositivita-reference-link">
        <ExternalLink size={14} />
        {trimmed}
      </a>
    );
  }
  return <span className="propositivita-reference-text">{trimmed}</span>;
}

function CreativeProposalCard({
  proposal,
  clientName,
  contactLabel,
  budgetTotal,
  onRequestStageChange,
  onAddBudget,
  onEdit,
  onDelete,
}: CreativeProposalCardProps) {
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const idleDays = getCreativeProposalIdleDays(proposal);
  const nextStage = getNextCreativeProposalStage(proposal.stage);
  const forwardStageOptions = getForwardCreativeProposalStageOptions(proposal.stage);
  const previousStage = getPreviousCreativeProposalStage(proposal.stage);
  const isDeadlineOverdue = isCreativeProposalDeadlineOverdue(proposal);
  const chronologicalActions = useMemo(
    () => resolveCreativeProposalActionsChronological(proposal),
    [proposal],
  );
  const lastActionDate = resolveLastCreativeActionAt(proposal).slice(0, 10);
  return (
    <article className="propositivita-card glass-card">
      <div className="propositivita-card-head">
        <div>
          <strong className="propositivita-creative-title">{proposal.title}</strong>
          <p className="propositivita-client-subtitle">{clientName}</p>
          <span className={`propositivita-company-badge is-${proposal.workspaceId || 'chimera'}`}>
            {resolveWorkspaceLabel(proposal.workspaceId)}
          </span>
          {contactLabel ? (
            <p className="propositivita-contact-subtitle">
              <Mail size={13} />
              {contactLabel}
            </p>
          ) : null}
        </div>
        <div className="propositivita-card-head-actions">
          <button
            type="button"
            className="btn-table-action"
            aria-label="Modifica creatività"
            onClick={() => onEdit(proposal)}
          >
            <Edit size={14} />
          </button>
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
      </div>
      <div className="propositivita-card-dates">
        <span className={`propositivita-card-deadline${isDeadlineOverdue ? ' is-overdue' : ''}`}>
          <Calendar size={14} />
          Deadline: {formatCreativeProposalDate(proposal.deadline)}
        </span>
        {lastActionDate ? (
          <span className="propositivita-card-last-action">
            Ultima azione: {formatCreativeProposalDate(lastActionDate)}
          </span>
        ) : null}
      </div>
      {proposal.description ? (
        <p className="propositivita-card-description">{proposal.description}</p>
      ) : null}
      {proposal.reference ? (
        <div className="propositivita-card-reference">
          <span className="propositivita-reference-label">Reference</span>
          {renderReference(proposal.reference)}
        </div>
      ) : null}
      <div className="propositivita-card-budget">
        <div className="propositivita-card-budget-meta">
          <Wallet size={14} />
          <span>Budget: {formatCurrency(budgetTotal)}</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onAddBudget(proposal.id)}
        >
          Aggiungi budget
        </button>
      </div>
      <div className="propositivita-card-stage-row">
        <span className={`propositivita-stage-badge ${getCreativeStageBadgeClass(proposal.stage)}`}>
          {CREATIVE_PROPOSAL_STAGE_LABELS[proposal.stage]}
        </span>
        <div className="propositivita-stage-actions">
          {previousStage ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onRequestStageChange({
                proposalId: proposal.id,
                nextStage: previousStage,
                direction: 'backward',
              })}
            >
              Indietro
            </button>
          ) : null}
          {forwardStageOptions.length > 0 ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onRequestStageChange({
                proposalId: proposal.id,
                nextStage: nextStage || forwardStageOptions[0],
                direction: 'forward',
              })}
            >
              Avanza
            </button>
          ) : null}
        </div>
      </div>
      <div className="propositivita-progress-wrap">
        <div className="propositivita-progress-track">
          <div
            className={`propositivita-progress-fill ${getCreativeProgressFillClass(proposal.progressPct)}`}
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
      {chronologicalActions.length > 0 ? (
        <div className="propositivita-card-timeline">
          <button
            type="button"
            className="propositivita-timeline-toggle"
            onClick={() => setIsTimelineOpen((prev) => !prev)}
            aria-expanded={isTimelineOpen}
          >
            {isTimelineOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {isTimelineOpen ? 'Nascondi cronologia date' : `Cronologia date (${chronologicalActions.length})`}
          </button>
          {isTimelineOpen ? (
            <ul className="propositivita-timeline-list">
              {chronologicalActions.map((action, index) => (
                <li key={`${action.stage}-${action.date}-${index}`} className="propositivita-timeline-item">
                  <div className="propositivita-timeline-item-head">
                    <span className="propositivita-timeline-date">
                      {formatCreativeProposalDate(action.date || action.timestamp.slice(0, 10))}
                    </span>
                    <span className={`propositivita-stage-badge ${getCreativeStageBadgeClass(action.stage)}`}>
                      {CREATIVE_PROPOSAL_STAGE_LABELS[action.stage]}
                    </span>
                  </div>
                  {action.note ? (
                    <p className="propositivita-timeline-note">{action.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
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
    updateCreativeProposalFields,
    removeCreativeProposal,
    createSpecialDiscount,
    registerCreativeProposalBudget,
    removeSpecialDiscount,
    currentOwner,
  } = useCrm();
  const { workspaceId, access } = useWorkspace();
  // Accesso personale: solo proposte creative e sconti di cui si è owner.
  const scopeOwner = access.scopeOwner;
  const allOwners = useMemo(() => {
    if (scopeOwner) return [scopeOwner];
    const ownerSet = new Set<string>();
    CRM_WORKSPACES.forEach((workspace) => {
      getOwnersForWorkspace(workspace.id).forEach((owner) => ownerSet.add(owner));
    });
    return [...ownerSet];
  }, [scopeOwner]);
  const allClients = useMemo(
    () => [...clients].sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [clients],
  );
  const clientsForCompany = (companyId: WorkspaceId) => clients
    .filter((client) => isClientInWorkspace(client, companyId))
    .sort((left, right) => left.name.localeCompare(right.name, 'it'));
  const activeClientsForCompany = (companyId: WorkspaceId) => {
    const workspaceIds = resolveClientWorkspaceIdsForCreativeCompany(companyId);
    return clients
      .filter((client) => isClientInActiveSection(client)
        && workspaceIds.some((workspaceId) => isClientInWorkspace(client, workspaceId)))
      .sort((left, right) => left.name.localeCompare(right.name, 'it'));
  };
  const coldClientsForCompany = (companyId: WorkspaceId) => {
    const workspaceIds = resolveClientWorkspaceIdsForCreativeCompany(companyId);
    return clients
      .filter((client) => isClientInColdSection(client)
        && workspaceIds.some((workspaceId) => isClientInWorkspace(client, workspaceId)))
      .sort((left, right) => left.name.localeCompare(right.name, 'it'));
  };
  const workspaceClients = useMemo(
    () => clientsForCompany(workspaceId),
    [clients, workspaceId],
  );
  const clientNameById = useMemo(
    () => new Map(allClients.map((client) => [client.id, client.name])),
    [allClients],
  );
  const [filterCompanyId, setFilterCompanyId] = useState<WorkspaceId | ''>('');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterStaleDays, setFilterStaleDays] = useState<number>(0);
  const [discountFilterClientId, setDiscountFilterClientId] = useState('');
  const [discountDateFrom, setDiscountDateFrom] = useState('');
  const [discountDateTo, setDiscountDateTo] = useState('');
  const [showCreativeForm, setShowCreativeForm] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState('');
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [stageChangeRequest, setStageChangeRequest] = useState<StageChangeRequest | null>(null);
  const [budgetProposalId, setBudgetProposalId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetDate, setBudgetDate] = useState(getTodayString());
  const [budgetNotes, setBudgetNotes] = useState('');
  const [budgetPo, setBudgetPo] = useState('');
  const [budgetType, setBudgetType] = useState<SpecialDiscountType>('spesa_extra');
  const [creativeWorkspaceId, setCreativeWorkspaceId] = useState<WorkspaceId>(workspaceId);
  const [creativeClientId, setCreativeClientId] = useState('');
  const [creativeContactId, setCreativeContactId] = useState('');
  const [creativeTitle, setCreativeTitle] = useState('');
  const [creativeDescription, setCreativeDescription] = useState('');
  const [creativeReference, setCreativeReference] = useState('');
  const [creativeDeadline, setCreativeDeadline] = useState('');
  const [creativeOwner, setCreativeOwner] = useState(currentOwner || '');
  const [creativeStage, setCreativeStage] = useState<CreativeProposalStage>('idea_nata');
  const [discountClientId, setDiscountClientId] = useState('');
  const [discountType, setDiscountType] = useState<SpecialDiscountType>('sconto');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [discountPo, setDiscountPo] = useState('');
  const [discountDate, setDiscountDate] = useState(getTodayString());
  const [discountOwner, setDiscountOwner] = useState(currentOwner || '');

  const formActiveClients = useMemo(
    () => activeClientsForCompany(creativeWorkspaceId),
    [clients, creativeWorkspaceId],
  );
  const formColdClients = useMemo(
    () => coldClientsForCompany(creativeWorkspaceId),
    [clients, creativeWorkspaceId],
  );
  const formOwners = useMemo(
    () => (scopeOwner ? [scopeOwner] : getOwnersForWorkspace(creativeWorkspaceId)),
    [creativeWorkspaceId, scopeOwner],
  );
  const discountOwners = useMemo(
    () => (scopeOwner ? [scopeOwner] : getOwnersForWorkspace(workspaceId)),
    [scopeOwner, workspaceId],
  );
  const filterableClients = useMemo(() => {
    if (!filterCompanyId) return allClients;
    return clientsForCompany(filterCompanyId);
  }, [allClients, clients, filterCompanyId]);
  const staleCount = useMemo(
    () => getStaleCreativeProposals(creativeProposals, 15).length,
    [creativeProposals],
  );
  const creativeReport = useMemo(
    () => buildCreativeProposalsReport(creativeProposals, specialDiscounts),
    [creativeProposals, specialDiscounts],
  );
  const budgetProposal = budgetProposalId
    ? creativeProposals.find((proposal) => proposal.id === budgetProposalId)
    : undefined;
  const selectedCreativeClient = useMemo(
    () => clients.find((client) => client.id === creativeClientId),
    [clients, creativeClientId],
  );
  const creativeContactOptions = useMemo(
    () => (selectedCreativeClient ? getCreativeProposalContacts(selectedCreativeClient) : []),
    [selectedCreativeClient],
  );
  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );
  const filteredProposals = useMemo(() => {
    return creativeProposals
      .filter((proposal) => {
        if (filterCompanyId && proposal.workspaceId !== filterCompanyId) return false;
        if (filterClientId && proposal.clientId !== filterClientId) return false;
        if (!isOwnedByScope(access, proposal.owner)) return false;
        if (filterOwner && proposal.owner !== filterOwner) return false;
        if (filterStage && proposal.stage !== filterStage) return false;
        if (filterStaleDays > 0 && getCreativeProposalIdleDays(proposal) < filterStaleDays) return false;
        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [access, creativeProposals, filterCompanyId, filterClientId, filterOwner, filterStage, filterStaleDays]);
  const workspaceDiscounts = useMemo(
    () => filterSpecialDiscountsByWorkspace(specialDiscounts, workspaceId)
      .filter((discount) => isOwnedByScope(access, discount.owner)),
    [access, specialDiscounts, workspaceId],
  );
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

  const stageChangeProposal = stageChangeRequest
    ? creativeProposals.find((proposal) => proposal.id === stageChangeRequest.proposalId)
    : undefined;

  const resetCreativeFilters = (): void => {
    setFilterCompanyId('');
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

  const resetCreativeForm = (): void => {
    setCreativeWorkspaceId(workspaceId);
    setCreativeClientId('');
    setCreativeContactId('');
    setCreativeTitle('');
    setCreativeDescription('');
    setCreativeReference('');
    setCreativeDeadline('');
    setCreativeStage('idea_nata');
    setCreativeOwner(scopeOwner ?? getDefaultOwnerForWorkspace(workspaceId));
  };

  const handleCreativeWorkspaceChange = (companyId: WorkspaceId): void => {
    setCreativeWorkspaceId(companyId);
    setCreativeClientId('');
    setCreativeContactId('');
    setCreativeOwner(scopeOwner ?? getDefaultOwnerForWorkspace(companyId));
  };

  const handleCreativeClientChange = (clientId: string): void => {
    setCreativeClientId(clientId);
    const client = clients.find((item) => item.id === clientId);
    if (!client) {
      setCreativeContactId('');
      return;
    }
    const contacts = getCreativeProposalContacts(client);
    setCreativeContactId(contacts[0]?.id || '');
  };

  const openCreateCreativeForm = (): void => {
    setEditingProposalId('');
    resetCreativeForm();
    setShowCreativeForm(true);
  };

  const openEditCreativeForm = (proposal: CreativeProposal): void => {
    setEditingProposalId(proposal.id);
    setCreativeWorkspaceId(
      proposal.workspaceId === 'tinytoast' ? 'tinytoast' : 'chimera',
    );
    setCreativeClientId(proposal.clientId);
    setCreativeContactId(proposal.contactId);
    setCreativeTitle(proposal.title);
    setCreativeDescription(proposal.description);
    setCreativeReference(proposal.reference);
    setCreativeDeadline(proposal.deadline);
    setCreativeOwner(proposal.owner);
    setShowCreativeForm(true);
  };

  const closeCreativeForm = (): void => {
    setShowCreativeForm(false);
    setEditingProposalId('');
    resetCreativeForm();
  };

  const handleSaveCreative = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!creativeClientId || !creativeTitle.trim() || !creativeDeadline) return;
    if (editingProposalId) {
      await updateCreativeProposalFields(editingProposalId, {
        workspaceId: creativeWorkspaceId,
        clientId: creativeClientId,
        contactId: creativeContactId,
        title: creativeTitle.trim(),
        description: creativeDescription.trim(),
        reference: creativeReference.trim(),
        deadline: creativeDeadline,
        owner: creativeOwner,
      });
    } else {
      await createCreativeProposal({
        clientId: creativeClientId,
        contactId: creativeContactId,
        workspaceId: creativeWorkspaceId,
        title: creativeTitle,
        description: creativeDescription,
        reference: creativeReference,
        deadline: creativeDeadline,
        owner: creativeOwner,
        stage: creativeStage,
      });
    }
    closeCreativeForm();
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
      po: discountPo,
      date: discountDate,
    });
    setShowDiscountForm(false);
    setDiscountClientId('');
    setDiscountAmount('');
    setDiscountReason('');
    setDiscountPo('');
    setDiscountDate(getTodayString());
  };

  const handleConfirmStageChange = async (
    targetStage: CreativeProposalStage,
    actionDate: string,
    note: string,
  ): Promise<void> => {
    if (!stageChangeRequest) return;
    await updateCreativeProposalStage(
      stageChangeRequest.proposalId,
      targetStage,
      actionDate,
      note,
    );
    setStageChangeRequest(null);
  };

  const openBudgetModal = (proposalId: string): void => {
    setBudgetProposalId(proposalId);
    setBudgetAmount('');
    setBudgetDate(getTodayString());
    setBudgetNotes('');
    setBudgetPo('');
    setBudgetType('spesa_extra');
  };

  const handleRegisterBudget = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!budgetProposalId || !budgetAmount.trim()) return;
    await registerCreativeProposalBudget(
      budgetProposalId,
      Number(budgetAmount),
      {
        type: budgetType,
        date: budgetDate,
        notes: budgetNotes,
        po: budgetPo,
      },
    );
    setBudgetProposalId('');
    setBudgetAmount('');
    setBudgetNotes('');
    setBudgetPo('');
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
          <div className="propositivita-summary">
            <div className="propositivita-summary-stats">
              <span>{creativeProposals.length} creatività</span>
              <span>{workspaceDiscounts.length} voci sconti/extra</span>
              {staleCount > 0 && <span className="is-warning">{staleCount} ferme da 15+ giorni</span>}
            </div>
          </div>

          <div className="propositivita-report-grid glass-card">
            <article className="propositivita-report-card">
              <span className="propositivita-report-label">Proposte al cliente</span>
              <strong className="propositivita-report-value">{creativeReport.sentToClientCount}</strong>
              <small>su {creativeReport.totalProposals} totali</small>
            </article>
            <article className="propositivita-report-card">
              <span className="propositivita-report-label">Spesa totale</span>
              <strong className="propositivita-report-value">{formatCurrency(creativeReport.totalSpent)}</strong>
              <small>Budget registrati dalle creatività</small>
            </article>
            <article className="propositivita-report-card is-converted">
              <span className="propositivita-report-label">Convertite</span>
              <strong className="propositivita-report-value">{creativeReport.convertedCount}</strong>
              <small>Chiusa approvata</small>
            </article>
            <article className="propositivita-report-card is-rejected">
              <span className="propositivita-report-label">Rifiutate</span>
              <strong className="propositivita-report-value">{creativeReport.rejectedCount}</strong>
              <small>Chiusa rifiutata</small>
            </article>
          </div>

          <div className="propositivita-block">
            <div className="glass-card propositivita-panel">
            <div className="propositivita-panel-head">
              <h4>Creatività propositive</h4>
              <button type="button" className="btn btn-primary" onClick={openCreateCreativeForm}>
                <PlusCircle size={16} />
                <span>Nuova creatività</span>
              </button>
            </div>
            <div className="propositivita-filters-grid">
              <label className="propositivita-filter-field">
                <span>Company</span>
                <select
                  className="form-select"
                  value={filterCompanyId}
                  onChange={(event) => {
                    setFilterCompanyId(event.target.value as WorkspaceId | '');
                    setFilterClientId('');
                  }}
                >
                  <option value="">Tutte</option>
                  {CRM_WORKSPACES.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>{workspace.shortLabel}</option>
                  ))}
                </select>
              </label>
              <label className="propositivita-filter-field">
                <span>Cliente</span>
                <select className="form-select" value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)}>
                  <option value="">Tutti i clienti</option>
                  {filterableClients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </label>
              <label className="propositivita-filter-field">
                <span>Owner</span>
                <select className="form-select" value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
                  <option value="">Tutti gli owner</option>
                  {allOwners.map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              </label>
              <label className="propositivita-filter-field">
                <span>Stadio</span>
                <select className="form-select" value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
                  <option value="">Tutti gli stadi</option>
                  {CREATIVE_PROPOSAL_STAGES.map((stage) => (
                    <option key={stage} value={stage}>{CREATIVE_PROPOSAL_STAGE_LABELS[stage]}</option>
                  ))}
                </select>
              </label>
              <label className="propositivita-filter-field">
                <span>Inattività</span>
                <select
                  className="form-select"
                  value={String(filterStaleDays)}
                  onChange={(e) => setFilterStaleDays(Number(e.target.value))}
                >
                  {STALE_DAY_OPTIONS.map((days) => (
                    <option key={days} value={days}>
                      {days === 0 ? 'Qualsiasi' : `${days}+ giorni`}
                    </option>
                  ))}
                </select>
              </label>
              {(filterCompanyId || filterClientId || filterOwner || filterStage || filterStaleDays > 0) && (
                <div className="propositivita-filter-reset">
                  <button type="button" className="btn btn-secondary" onClick={resetCreativeFilters}>
                    <FilterX size={14} />
                    Reset filtri
                  </button>
                </div>
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
                    contactLabel={resolveCreativeProposalContactLabel(
                      clientById.get(proposal.clientId),
                      proposal.contactId,
                    )}
                    budgetTotal={resolveCreativeProposalBudgetTotal(proposal.id, specialDiscounts)}
                    onRequestStageChange={setStageChangeRequest}
                    onAddBudget={openBudgetModal}
                    onEdit={openEditCreativeForm}
                    onDelete={removeCreativeProposal}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="propositivita-block">
            <div className="glass-card propositivita-panel">
            <div className="propositivita-panel-head">
              <h4>Sconti ed extra</h4>
              <button type="button" className="btn btn-primary" onClick={() => setShowDiscountForm(true)}>
                <PlusCircle size={16} />
                <span>Registra voce</span>
              </button>
            </div>
            <div className="propositivita-filters-grid propositivita-filters-grid--discounts">
              <label className="propositivita-filter-field">
                <span>Cliente</span>
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
              </label>
              <label className="propositivita-filter-field">
                <span>Data da</span>
                <input
                  type="date"
                  className="form-input"
                  value={discountDateFrom}
                  onChange={(e) => setDiscountDateFrom(e.target.value)}
                />
              </label>
              <label className="propositivita-filter-field">
                <span>Data a</span>
                <input
                  type="date"
                  className="form-input"
                  value={discountDateTo}
                  onChange={(e) => setDiscountDateTo(e.target.value)}
                />
              </label>
              {(discountFilterClientId || discountDateFrom || discountDateTo) && (
                <div className="propositivita-filter-reset">
                  <button type="button" className="btn btn-secondary" onClick={resetDiscountFilters}>
                    <FilterX size={14} />
                    Reset filtri
                  </button>
                </div>
              )}
            </div>
            </div>
            <div className="glass-card propositivita-table-wrap">
              <div className="propositivita-discounts-list">
                <div className="propositivita-discounts-header" role="row">
                  <span role="columnheader">Cliente</span>
                  <span role="columnheader">Tipo</span>
                  <span role="columnheader">Motivo</span>
                  <span role="columnheader">PO</span>
                  <span role="columnheader" className="is-num">Valore</span>
                  <span role="columnheader">Data</span>
                  <span role="columnheader" className="is-actions" aria-label="Azioni" />
                </div>
                {filteredDiscounts.length === 0 ? (
                  <div className="propositivita-discounts-empty">Nessuna voce registrata.</div>
                ) : (
                  filteredDiscounts.map((discount) => (
                    <div key={discount.id} className="propositivita-discounts-row" role="row">
                      <span className="propositivita-discount-client" role="cell">
                        {clientNameById.get(discount.clientId) || 'Cliente sconosciuto'}
                      </span>
                      <span className="propositivita-discount-type" role="cell">
                        <span className={getDiscountTypeBadgeClass(discount.type)}>
                          {SPECIAL_DISCOUNT_TYPE_LABELS[discount.type]}
                        </span>
                      </span>
                      <span className="propositivita-discount-reason" role="cell">
                        {discount.reason || '—'}
                      </span>
                      <span className="propositivita-discount-po" role="cell">
                        {discount.po || '—'}
                      </span>
                      <span className="propositivita-discount-value" role="cell">
                        <span className={discount.type === 'sconto' ? 'propositivita-amount is-discount' : 'propositivita-amount is-extra'}>
                          {formatDiscountAmount(discount.type, discount.amount)}
                        </span>
                      </span>
                      <span className="propositivita-discount-date" role="cell">
                        {formatCreativeProposalDate(discount.date)}
                      </span>
                      <span className="propositivita-discount-actions" role="cell">
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
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {showCreativeForm && (
        <>
          <div className="drawer-overlay open" onClick={closeCreativeForm} />
          <div className="drawer open">
            <div className="drawer-header">
              <h3>{editingProposalId ? 'Modifica creatività' : 'Nuova creatività'}</h3>
            </div>
            <form onSubmit={(event) => void handleSaveCreative(event)}>
              <div className="drawer-body">
                <label className="form-label">
                  Company *
                  <select
                    className="form-select"
                    value={creativeWorkspaceId}
                    onChange={(event) => handleCreativeWorkspaceChange(event.target.value as WorkspaceId)}
                    required
                  >
                    {CRM_WORKSPACES.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>{workspace.label}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Cliente
                  <ClientSearchSelect
                    activeClients={formActiveClients}
                    coldClients={formColdClients}
                    value={creativeClientId}
                    onChange={handleCreativeClientChange}
                    required
                    placeholder="Cerca cliente per nome..."
                  />
                </label>
                {creativeClientId && creativeContactOptions.length > 0 ? (
                  <label className="form-label">
                    Contatto mail
                    <select
                      className="form-select"
                      value={creativeContactId}
                      onChange={(event) => setCreativeContactId(event.target.value)}
                    >
                      {creativeContactOptions.map((contact) => (
                        <option key={contact.id || 'default'} value={contact.id}>
                          {contact.name.trim() || selectedCreativeClient?.name || 'Contatto'}
                          {contact.email ? ` · ${contact.email}` : ''}
                          {contact.role ? ` · ${contact.role}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="form-label">
                  Titolo
                  <input className="form-input" value={creativeTitle} onChange={(e) => setCreativeTitle(e.target.value)} required />
                </label>
                <label className="form-label">
                  Descrizione
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={creativeDescription}
                    onChange={(e) => setCreativeDescription(e.target.value)}
                    placeholder="Descrivi l'idea creativa proposta al cliente..."
                  />
                </label>
                <label className="form-label">
                  Reference
                  <input
                    className="form-input"
                    value={creativeReference}
                    onChange={(e) => setCreativeReference(e.target.value)}
                    placeholder="Link o riferimento (es. Figma, Drive, moodboard...)"
                  />
                </label>
                <label className="form-label">
                  Deadline *
                  <input
                    className="form-input"
                    type="date"
                    value={creativeDeadline}
                    onChange={(e) => setCreativeDeadline(e.target.value)}
                    required
                  />
                </label>
                <label className="form-label">
                  Owner
                  <select className="form-select" value={creativeOwner} onChange={(e) => setCreativeOwner(e.target.value)}>
                    <option value="">—</option>
                    {formOwners.map((owner) => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
                  </select>
                </label>
                {!editingProposalId ? (
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
                ) : null}
              </div>
              <div className="drawer-footer">
                <button type="button" className="btn btn-secondary" onClick={closeCreativeForm}>Annulla</button>
                <button type="submit" className="btn btn-primary">
                  {editingProposalId ? 'Salva modifiche' : 'Salva'}
                </button>
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
                  Numero PO
                  <input
                    className="form-input"
                    value={discountPo}
                    onChange={(e) => setDiscountPo(e.target.value)}
                    placeholder="Ordine di acquisto (opzionale)"
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
                    {discountOwners.map((owner) => (
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

      {stageChangeRequest && stageChangeProposal ? (
        <CreativeStageModal
          clientName={clientNameById.get(stageChangeProposal.clientId) || 'Cliente sconosciuto'}
          proposalTitle={stageChangeProposal.title}
          currentStage={stageChangeProposal.stage}
          nextStage={stageChangeRequest.nextStage}
          direction={stageChangeRequest.direction}
          targetStageOptions={
            stageChangeRequest.direction === 'forward'
              ? getForwardCreativeProposalStageOptions(stageChangeProposal.stage)
              : []
          }
          onClose={() => setStageChangeRequest(null)}
          onConfirm={(targetStage, actionDate, note) => void handleConfirmStageChange(targetStage, actionDate, note)}
        />
      ) : null}

      {budgetProposalId && budgetProposal ? (
        <>
          <div className="drawer-overlay open" onClick={() => setBudgetProposalId('')} />
          <div className="drawer open">
            <div className="drawer-header">
              <h3>Budget creatività — {budgetProposal.title}</h3>
            </div>
            <form onSubmit={(event) => void handleRegisterBudget(event)}>
              <div className="drawer-body">
                <p className="creative-stage-modal-subtitle">
                  Cliente: {clientNameById.get(budgetProposal.clientId) || 'Cliente sconosciuto'}
                </p>
                <p className="creative-stage-modal-hint">
                  La voce verrà registrata automaticamente in Sconti ed extra.
                </p>
                <label className="form-label">
                  Tipo
                  <select
                    className="form-select"
                    value={budgetType}
                    onChange={(event) => setBudgetType(event.target.value as SpecialDiscountType)}
                  >
                    <option value="spesa_extra">Spesa extra</option>
                    <option value="sconto">Sconto</option>
                    <option value="omaggio">Omaggio</option>
                  </select>
                </label>
                <label className="form-label">
                  Importo *
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={budgetAmount}
                    onChange={(event) => setBudgetAmount(event.target.value)}
                    required
                  />
                </label>
                <label className="form-label">
                  Data *
                  <input
                    className="form-input"
                    type="date"
                    value={budgetDate}
                    onChange={(event) => setBudgetDate(event.target.value)}
                    required
                  />
                </label>
                <label className="form-label">
                  Numero PO
                  <input
                    className="form-input"
                    value={budgetPo}
                    onChange={(event) => setBudgetPo(event.target.value)}
                    placeholder="Ordine di acquisto (opzionale)"
                  />
                </label>
                <label className="form-label">
                  Note
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={budgetNotes}
                    onChange={(event) => setBudgetNotes(event.target.value)}
                    placeholder="Dettagli sul costo della creatività..."
                  />
                </label>
              </div>
              <div className="drawer-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setBudgetProposalId('')}>
                  Annulla
                </button>
                <button type="submit" className="btn btn-primary">Registra in Sconti ed extra</button>
              </div>
            </form>
          </div>
        </>
      ) : null}
    </>
  );
}
