'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, FileText, PhoneCall } from 'lucide-react';
import { ClientDrawer } from '@/components/drawers/client-drawer';
import { TopHeader } from '@/components/layout/top-header';
import { normalizeOwner } from '@/lib/crm/owners';
import { formatActionDateDisplay } from '@/lib/crm/utils';
import { getOwnersForWorkspace } from '@/lib/crm/workspace-clients';
import { CALL_DEBRIEF_DELAY_DAYS } from '@/lib/reminders/call-debrief';
import type { CallDebriefReminder } from '@/lib/reminders/call-debrief';
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

export function ReminderSection() {
  const { currentOwner } = useCrm();
  const { workspaceId } = useWorkspace();
  const { callDebriefReminders, isLoading, error, markCallDebriefDone } = useReminders();
  const owners = useMemo(() => getOwnersForWorkspace(workspaceId), [workspaceId]);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [openClient, setOpenClient] = useState<Client | null>(null);

  // Ognuno parte dai reminder dei propri clienti; «Tutti» mostra quelli di tutto il team.
  useEffect(() => {
    if (ownerFilter !== null) return;
    if (currentOwner) setOwnerFilter(currentOwner);
  }, [currentOwner, ownerFilter]);

  const activeOwner = ownerFilter ?? ALL_OWNERS;
  const visibleReminders = useMemo(
    () => callDebriefReminders.filter((reminder) => !activeOwner
      || normalizeOwner(reminder.client.owner) === normalizeOwner(activeOwner)),
    [activeOwner, callDebriefReminders],
  );
  const dueReminders = visibleReminders.filter(isReminderDue);
  const upcomingReminders = visibleReminders.filter((reminder) => !isReminderDue(reminder));

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="table-filter-bar">
            <div className="filter-left">
              <div className="proposals-list-chips" role="group" aria-label="Reminder di">
                <button
                  type="button"
                  className={`clients-filter-chip${activeOwner === ALL_OWNERS ? ' is-active' : ''}`}
                  aria-pressed={activeOwner === ALL_OWNERS}
                  onClick={() => setOwnerFilter(ALL_OWNERS)}
                >
                  Tutti
                </button>
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
              <p className="reminder-empty">Nessuna call debrief da fare{activeOwner ? ` per ${activeOwner.split(' ')[0]}` : ''}. 🎉</p>
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
        </section>
      </div>
      {openClient && (
        <ClientDrawer client={openClient} isCold={false} workspaceId={workspaceId} onClose={() => setOpenClient(null)} />
      )}
    </>
  );
}
