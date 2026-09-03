'use client';

interface ProposalsKpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  valueClassName?: string;
  amountLabel?: string;
  isClickable?: boolean;
  onClick?: () => void;
}

export function ProposalsKpiCard({
  label,
  value,
  hint,
  valueClassName,
  amountLabel,
  isClickable = false,
  onClick,
}: ProposalsKpiCardProps) {
  const content = (
    <>
      <span className="analysis-kpi-label">{label}</span>
      <strong className={`analysis-kpi-value${valueClassName ? ` ${valueClassName}` : ''}`}>
        {value}
      </strong>
      {amountLabel ? <span className="analysis-kpi-hint proposals-kpi-amount">{amountLabel}</span> : null}
      {hint ? <span className="analysis-kpi-hint">{hint}</span> : null}
    </>
  );
  if (!isClickable) {
    return <div className="analysis-kpi-card">{content}</div>;
  }
  return (
    <button
      type="button"
      className="analysis-kpi-card proposals-kpi-card proposals-kpi-card--clickable"
      onClick={onClick}
    >
      {content}
    </button>
  );
}
