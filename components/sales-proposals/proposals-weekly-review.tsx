'use client';

import { useMemo, useState } from 'react';
import { ProposalsKpiCard } from '@/components/sales-proposals/proposals-kpi-card';
import { ProposalsWeeklyList } from '@/components/sales-proposals/proposals-weekly-list';
import {
  buildProposalWeeklyReview,
  collectProposalIsoYears,
  formatProposalCurrency,
  getIsoWeeksInYear,
  getPreviousIsoWeekRef,
  getWeekRangeFromIsoWeek,
} from '@/lib/sales-proposals/stats';
import type { ProposalIsoWeekRef, SalesProposal } from '@/lib/types/sales-proposals';

interface ProposalsWeeklyReviewProps {
  proposals: SalesProposal[];
}

function resolveDefaultWeekRef(): ProposalIsoWeekRef {
  return getPreviousIsoWeekRef(new Date());
}

export function ProposalsWeeklyReview({ proposals }: ProposalsWeeklyReviewProps) {
  const currentYear = new Date().getFullYear();
  const defaultWeekRef = useMemo(() => resolveDefaultWeekRef(), []);
  const [isoYear, setIsoYear] = useState(defaultWeekRef.isoYear);
  const [isoWeek, setIsoWeek] = useState(defaultWeekRef.isoWeek);
  const yearOptions = useMemo(
    () => collectProposalIsoYears(proposals, currentYear),
    [currentYear, proposals],
  );
  const maxWeekForYear = useMemo(() => getIsoWeeksInYear(isoYear), [isoYear]);
  const weekOptions = useMemo(
    () => Array.from({ length: maxWeekForYear }, (_, index) => {
      const week = index + 1;
      const range = getWeekRangeFromIsoWeek(isoYear, week);
      return {
        week,
        label: `Sett. ${week} · ${range.weekLabel}`,
      };
    }),
    [isoYear, maxWeekForYear],
  );
  const summary = useMemo(
    () => buildProposalWeeklyReview(proposals, { isoYear, isoWeek }),
    [isoWeek, isoYear, proposals],
  );
  const handleYearChange = (nextYear: number): void => {
    setIsoYear(nextYear);
    const weeksInYear = getIsoWeeksInYear(nextYear);
    setIsoWeek((current) => Math.min(current, weeksInYear));
  };
  return (
    <div className="proposals-weekly-review">
      <div className="glass-card proposals-panel proposals-weekly-review-head">
        <div className="proposals-panel-head">
          <h3>Weekly review</h3>
          <p>
            Settimana {summary.isoWeek} del {summary.isoYear} ({summary.weekLabel}).
            Nuove e pending per data di creazione; Si e No per data di chiusura.
            Pending = create in settimana e non chiuse entro fine settimana.
          </p>
        </div>
        <div className="proposals-weekly-selectors">
          <label className="proposals-weekly-select">
            <span>Anno</span>
            <select
              className="filter-select"
              value={isoYear}
              onChange={(event) => handleYearChange(Number(event.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <label className="proposals-weekly-select">
            <span>Settimana</span>
            <select
              className="filter-select"
              value={isoWeek}
              onChange={(event) => setIsoWeek(Number(event.target.value))}
            >
              {weekOptions.map((option) => (
                <option key={option.week} value={option.week}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="proposals-weekly-kpi-grid">
        <ProposalsKpiCard
          label="Nuove proposte"
          value={summary.newCount}
          amountLabel={formatProposalCurrency(summary.newTotalValue)}
          hint="Create nella settimana selezionata · valore quotato"
        />
        <ProposalsKpiCard
          label="Andate in Si"
          value={summary.acceptedCount}
          amountLabel={formatProposalCurrency(summary.acceptedTotalValue)}
          hint="Chiuse Si nella settimana selezionata"
          valueClassName="analysis-kpi-positive"
        />
        <ProposalsKpiCard
          label="Andate in No"
          value={summary.rejectedCount}
          amountLabel={formatProposalCurrency(summary.rejectedTotalValue)}
          hint="Chiuse No nella settimana selezionata"
          valueClassName="analysis-kpi-negative"
        />
        <ProposalsKpiCard
          label="Ancora pending"
          value={summary.pendingCount}
          amountLabel={formatProposalCurrency(summary.pendingTotalValue)}
          hint="Create in settimana, non chiuse Si/No entro domenica"
          valueClassName="proposals-kpi-pending"
        />
      </div>
      <div className="proposals-weekly-lists">
        <ProposalsWeeklyList
          title="Proposte andate in Si"
          emptyLabel="Nessuna proposta chiusa Si in questa settimana."
          proposals={summary.acceptedProposals}
          closedDateLabel="Data Si"
          resolveClosedDate={(proposal) => proposal.dataAccettazione}
        />
        <ProposalsWeeklyList
          title="Proposte andate in No"
          emptyLabel="Nessuna proposta chiusa No in questa settimana."
          proposals={summary.rejectedProposals}
          closedDateLabel="Data No"
          resolveClosedDate={(proposal) => proposal.dataRifiuto}
        />
        <ProposalsWeeklyList
          title="Proposte ancora pending"
          emptyLabel="Nessuna proposta rimasta aperta a fine settimana."
          proposals={summary.pendingProposals}
          closedDateLabel="Creata il"
          resolveClosedDate={(proposal) => proposal.creatoIl}
        />
      </div>
    </div>
  );
}
