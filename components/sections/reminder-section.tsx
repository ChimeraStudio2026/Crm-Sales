'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, FileText, Hourglass, PhoneCall } from 'lucide-react';
import { ClientDrawer } from '@/components/drawers/client-drawer';
import { TopHeader } from '@/components/layout/top-header';
import { normalizeOwner } from '@/lib/crm/owners';
import { formatActionDateDisplay } from '@/lib/crm/utils';
import { getOwnersForWorkspace } from '@/lib/crm/workspace-clients';
import { CALL_DEBRIEF_DELAY_DAYS } from '@/lib/reminders/call-debrief';
import type { CallDebriefReminder } from '@/lib/reminders/call-debrief';
import { STALE_CLIENT_DAYS } from '@/lib/reminders/stale-clients';
import type { StaleClientReminder } from '@/lib/reminders/stale-clients';
import { formatProposalCurrency, resolveProposalValue } from '@/lib/sales-proposals/stats';
import type { Client } from '@/lib/types/crm';
import { useCrm } from '@/providers/crm-provider';
import { isReminderDue, useReminders } from '@/providers/reminders-provider';
import { useWorkspace } from '@/providers/workspace-provider';

const ALL_OWNERS = '';

function formatDue(reminder: CallDebriefReminder): string {
  if (reminder.daysToDue === 0) return 'Da fare oggi';
  if (reminder.daysToDue < 0) {
    const late = Math.abs(reminder.daysToDue);
    return `Da fare da ${late} ${late === 1 ? 'giorno' : 'giorni'}`;
  }
  return `Tra ${reminder.daysToDue} ${reminder.daysToDue === 1 ? 'giorno' : 'giorni'}`;
}

function CallDebriefCard({
  reminder,
  onOpenClient,
  onDone,
}: {
  reminder: CallDebriefReminder;
  onOpenClient: (client: Client) => void;
  onDone: (reminder: CallDebriefReminder, note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const value = resolveProposalValue(reminder.proposal);

  const handleDone = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await onDone(reminder, note);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className={`reminder-card${reminder.daysToDue < 0 ? ' is-late' : ''}`}>
      <header className="reminder-card-head">
        <span className="reminder-card-icon"><PhoneCall size={16} /></span>
        <div className="reminder-card-title">
          <button type="button" className="reminder-card-client" onClick={() => onOpenClient(reminder.client)}>
            {reminder.client.name}
          </button>
          <small>{reminder.client.owner || 'Senza owner'}</small>
        </div>
        <span className={`reminder-card-due${reminder.daysToDue < 0 ? ' is-late' : ''}`}>{formatDue(reminder)}</span>
      </header>
      <p className="reminder-card-text">
        Cliente nuovo: fai la call per presentargli Chimera.
      </p>
      <p className="reminder-card-proposal">
        <FileText size={13} />
        <span>
          {reminder.proposal.nome}
          {value !== null ? ` · ${formatProposalCurrency(value)}` : ''}
          {` · accettata il ${formatActionDateDisplay(reminder.acceptedOn)}`}
        </span>
      </p>
      <div className="reminder-card-done">
        <input
          className="form-input"
          placeholder="Com'è andata? (facoltativo)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleDone()} disabled={isSaving}>
          <Check size={14} />
          <span>{isSaving ? 'Salvo…' : 'Fatta'}</span>
        </button>
      </div>
    </article>
  );
}

const STALE_ACTIVITY_LABELS: Record<NonNullable<StaleClientReminder['lastActivity']>['kind'], string> = {
  azione: 'Ultima azione',
  campagna: 'Ultima azione in campagna',
  proposta: 'Ultima proposta',
};

function formatStaleSince(reminder: StaleClientReminder): string {
  if (reminder.daysSince === null) return 'Mai sentito';
  const weeks = Math.floor(reminder.daysSince / 7);
  return reminder.daysSince >= 14 ? `Fermo da ${weeks} settimane` : `Fermo da ${reminder.daysSince} giorni`;
}

function StaleClientRow({
  reminder,
  showOwner,
  onOpenClient,
}: {
  reminder: StaleClientReminder;
  showOwner: boolean;
  onOpenClient: (client: Client) => void;
}) {
  const { lastActivity } = reminder;
  return (
    <li className={`reminder-stale-row${reminder.daysSince === null || reminder.daysSince > STALE_CLIENT_DAYS * 2 ? ' is-late' : ''}`}>
      <div className="reminder-stale-main">
        <button type="button" className="reminder-card-client" onClick={() => onOpenClient(reminder.client)}>
          {reminder.client.name}
        </button>
        <small>
          {reminder.client.relationship}
          {showOwner ? ` · ${reminder.client.owner || 'Senza owner'}` : ''}
        </small>
      </div>
      <span className="reminder-stale-last">
        {lastActivity
          ? `${STALE_ACTIVITY_LABELS[lastActivity.kind]}: ${lastActivity.label} · ${formatActionDateDisplay(lastActivity.day)}`
          : 'Nessuna proposta o azione registrata'}
      </span>
      <span className="reminder-stale-since">{formatStaleSince(reminder)}</span>
    </li>
  );
}

export function ReminderSection() {
  const { currentOwner } = useCrm();
  const { workspaceId, access } = useWorkspace();
  const { callDebriefReminders, staleClientReminders, isLoading, error, markCallDebriefDone } = useReminders();
  // Accesso personale: solo la propria scheda.
  const owners = useMemo(
    () => (access.scopeOwner ? [access.scopeOwner] : getOwnersForWorkspace(workspaceId)),
    [access.scopeOwner, workspaceId],
  );
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [openClient, setOpenClient] = useState<Client | null>(null);

  // Ognuno parte dai reminder dei propri clienti; «Tutti» mostra quelli di tutto il team.
  useEffect(() => {
    if (ownerFilter !== null) return;
    if (currentOwner) setOwnerFilter(currentOwner);
  }, [currentOwner, ownerFilter]);

  const activeOwner = access.scopeOwner ?? ownerFilter ?? ALL_OWNERS;
  const isOwnedBy = (client: Client, owner: string): boolean => !owner
    || normalizeOwner(client.owner) === normalizeOwner(owner);
  const visibleReminders = callDebriefReminders.filter((reminder) => isOwnedBy(reminder.client, activeOwner));
  const dueReminders = visibleReminders.filter(isReminderDue);
  const upcomingReminders = visibleReminders.filter((reminder) => !isReminderDue(reminder));
  const visibleStaleClients = staleClientReminders.filter((reminder) => isOwnedBy(reminder.client, activeOwner));
  // Sul tab di ogni persona: call da fare adesso + clienti fermi.
  const countFor = (owner: string): number => callDebriefReminders
    .filter((reminder) => isReminderDue(reminder) && isOwnedBy(reminder.client, owner)).length
    + staleClientReminders.filter((reminder) => isOwnedBy(reminder.client, owner)).length;
  const ownerName = activeOwner ? activeOwner.split(' ')[0] : '';

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="table-filter-bar">
            <div className="filter-left">
              <div className="proposals-list-chips" role="tablist" aria-label="Reminder di">
                {!access.scopeOwner && (
                <button
                  type="button"
                  className={`clients-filter-chip${activeOwner === ALL_OWNERS ? ' is-active' : ''}`}
                  aria-pressed={activeOwner === ALL_OWNERS}
                  onClick={() => setOwnerFilter(ALL_OWNERS)}
                >
                  Tutto il team
                  {!isLoading && <span className="clients-filter-chip-count">{countFor(ALL_OWNERS)}</span>}
                </button>
                )}
                {owners.map((owner) => (
                  <button
                    key={owner}
                    type="button"
                    className={`clients-filter-chip${activeOwner === owner ? ' is-active' : ''}`}
                    aria-pressed={activeOwner === owner}
                    title={`Reminder dei clienti di ${owner}`}
                    onClick={() => setOwnerFilter(owner)}
                  >
                    {owner.split(' ')[0]}
                    {!isLoading && <span className="clients-filter-chip-count">{countFor(owner)}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="reminder-group">
            <div className="reminder-group-head">
              <h2>
                <PhoneCall size={18} />
                Call debrief
                {dueReminders.length > 0 && <span className="reminder-count">{dueReminders.length}</span>}
              </h2>
              <p>
                Quando la prima proposta di un cliente nuovo passa a «Si», dopo {CALL_DEBRIEF_DELAY_DAYS} giorni
                compare qui il promemoria per la call di presentazione di Chimera. Segnala come fatta e finisce
                nella scheda cliente.
              </p>
            </div>
            {isLoading ? (
              <p className="reminder-empty">Caricamento reminder…</p>
            ) : error ? (
              <p className="reminder-empty">Reminder non disponibili: {error}</p>
            ) : dueReminders.length === 0 ? (
              <p className="reminder-empty">Nessuna call debrief da fare{ownerName ? ` per ${ownerName}` : ''}. 🎉</p>
            ) : (
              <div className="reminder-cards">
                {dueReminders.map((reminder) => (
                  <CallDebriefCard
                    key={reminder.client.id}
                    reminder={reminder}
                    onOpenClient={setOpenClient}
                    onDone={markCallDebriefDone}
                  />
                ))}
              </div>
            )}
            {upcomingReminders.length > 0 && (
              <div className="reminder-upcoming">
                <h3><CalendarClock size={15} /> In arrivo</h3>
                <ul>
                  {upcomingReminders.map((reminder) => (
                    <li key={reminder.client.id}>
                      <button type="button" className="reminder-card-client" onClick={() => setOpenClient(reminder.client)}>
                        {reminder.client.name}
                      </button>
                      <span>{reminder.client.owner || 'Senza owner'}</span>
                      <span>{formatDue(reminder)} · dal {formatActionDateDisplay(reminder.dueOn)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="reminder-group">
            <div className="reminder-group-head">
              <h2>
                <Hourglass size={18} />
                Clienti fermi
                {!isLoading && visibleStaleClients.length > 0 && (
                  <span className="reminder-count">{visibleStaleClients.length}</span>
                )}
              </h2>
              <p>
                Clienti senza nuove proposte né azioni (azioni cliente, obiettivi, campagne) da più di
                {` ${STALE_CLIENT_DAYS / 7}`} settimane. Prima chi è fermo da più tempo: apri il cliente e registra
                un'azione per toglierlo dalla lista.
              </p>
            </div>
            {isLoading ? (
              <p className="reminder-empty">Caricamento clienti…</p>
            ) : error ? (
              <p className="reminder-empty">Reminder non disponibili: {error}</p>
            ) : visibleStaleClients.length === 0 ? (
              <p className="reminder-empty">Nessun cliente fermo{ownerName ? ` per ${ownerName}` : ''}. 🎉</p>
            ) : (
              <ul className="reminder-stale-list">
                {visibleStaleClients.map((reminder) => (
                  <StaleClientRow
                    key={reminder.client.id}
                    reminder={reminder}
                    showOwner={!activeOwner}
                    onOpenClient={setOpenClient}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
      {openClient && (
        <ClientDrawer client={openClient} isCold={false} workspaceId={workspaceId} onClose={() => setOpenClient(null)} />
      )}
    </>
  );
}
