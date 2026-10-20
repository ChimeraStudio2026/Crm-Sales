import { ChimeraWordmark } from '@/components/ui/chimera-wordmark';
import { formatQuoteCurrency, getSectionTotals, itemPrice } from '@/lib/quotes/calc';
import { buildQuoteConditions } from '@/lib/quotes/conditions';
import { buildQuoteDisplayTitle, getSectionNote, resolveItemCode, resolveSectionReportNote } from '@/lib/quotes/draft';
import { QUOTE_SECTIONS, type QuoteSectionDefinition } from '@/lib/quotes/sections';
import type { QuoteDraft, QuoteTotals } from '@/lib/quotes/types';

interface QuotePrintViewProps {
  readonly quote: QuoteDraft;
  readonly totals: QuoteTotals;
}

function formatPrintDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value || 0);
}

function PrintHeader({ quote, heading }: { readonly quote: QuoteDraft; readonly heading: string }) {
  return (
    <header className="quote-print-header">
      <span className="quote-print-badge" aria-hidden>C</span>
      <h1>{buildQuoteDisplayTitle(quote)}</h1>
      <h2>{heading}</h2>
    </header>
  );
}

function PrintFooterLogo() {
  return (
    <div className="quote-print-logo">
      <ChimeraWordmark height={36} />
      <span>S T U D I O</span>
    </div>
  );
}

function SectionPage({ quote, totals, section }: QuotePrintViewProps & { readonly section: QuoteSectionDefinition }) {
  const items = quote.items.filter((item) => item.section === section.code);
  const sectionTotals = getSectionTotals(totals, section.code);
  return (
    <section className="quote-print-page">
      <PrintHeader quote={quote} heading={`${section.letter}. ${section.label}`} />
      <div className="quote-print-meta">
        <dl>
          <div><dt>Quote Date:</dt><dd>{formatPrintDate(quote.quoteDate)}</dd></div>
          <div><dt>Description:</dt><dd>{section.label}</dd></div>
          <div><dt>Country:</dt><dd>{quote.country}</dd></div>
        </dl>
        <dl>
          <div><dt>Client:</dt><dd>{quote.clientName}</dd></div>
        </dl>
        <div className="quote-print-note">
          <strong>NOTE</strong>
          <span>{getSectionNote(quote, section.code)}</span>
        </div>
      </div>
      <table className="quote-print-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>JOB</th>
            <th>NOTE</th>
            <th className="is-numeric">QTY</th>
            {section.splitDays ? (
              <>
                <th className="is-numeric">PREP</th>
                <th className="is-numeric">SHOOT</th>
              </>
            ) : (
              <th className="is-numeric">DAYS</th>
            )}
            <th className="is-numeric">UNIT PRICE</th>
            <th className="is-numeric">NIC</th>
            <th className="is-numeric">PRICE</th>
            <th className="is-numeric">EXTRAS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{resolveItemCode(quote, item)}</td>
              <td>{item.job}</td>
              <td>{item.note}</td>
              <td className="is-numeric">{formatNumber(item.qty)}</td>
              {section.splitDays ? <td className="is-numeric">{formatNumber(item.prepDays)}</td> : null}
              <td className="is-numeric">{formatNumber(item.days)}</td>
              <td className="is-numeric">{formatQuoteCurrency(item.unitPrice)}</td>
              <td className="is-numeric">{formatNumber(item.nic)}%</td>
              <td className="is-numeric">{formatQuoteCurrency(itemPrice(item))}</td>
              <td className="is-numeric quote-print-extras">{formatQuoteCurrency(item.extras)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="quote-print-bottom">
        <PrintFooterLogo />
        <dl className="quote-print-section-totals">
          <div>
            <dt><strong>{section.label} SUB TOTAL:</strong></dt>
            <dd><strong>{formatQuoteCurrency(sectionTotals.subtotal)}</strong></dd>
            <dd><strong>{formatQuoteCurrency(sectionTotals.extras)}</strong><br />+IVA</dd>
          </div>
          <div>
            <dt>PRODUCTION FEE <strong>{formatNumber(quote.productionFeePct)}%</strong></dt>
            <dd><strong>{formatQuoteCurrency(sectionTotals.fee)}</strong></dd>
            <dd><strong>+IVA</strong></dd>
          </div>
          <div className="is-total">
            <dt>{section.label} TOTAL</dt>
            <dd>{formatQuoteCurrency(sectionTotals.total)}</dd>
            <dd>+IVA</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/** Versione stampabile: stessa impaginazione del PDF esportato da Cerbero. */
export function QuotePrintView({ quote, totals }: QuotePrintViewProps) {
  const usedSections = QUOTE_SECTIONS.filter((section) => quote.items.some((item) => item.section === section.code));
  return (
    <div className="quote-print">
      <section className="quote-print-page">
        <PrintHeader quote={quote} heading="REPORT" />
        <div className="quote-print-meta">
          <dl>
            <div><dt>Quote Date:</dt><dd>{formatPrintDate(quote.quoteDate)}</dd></div>
            <div><dt>Description:</dt><dd>{quote.description}</dd></div>
            <div><dt>Country:</dt><dd>{quote.country}</dd></div>
            <div><dt>Client:</dt><dd>{quote.clientName}</dd></div>
          </dl>
          <address className="quote-print-recipient">
            <em>Spett. le</em>
            <strong>{quote.clientName}</strong>
            {quote.clientVat ? <span>{quote.clientVat}</span> : null}
            {quote.clientAddress ? <span>{quote.clientAddress}</span> : null}
          </address>
        </div>
        <table className="quote-print-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>ITEM</th>
              <th>NOTE</th>
              <th className="is-numeric">PRICE</th>
              <th className="is-numeric">EXTRAS</th>
            </tr>
          </thead>
          <tbody>
            {QUOTE_SECTIONS.map((section) => {
              const sectionTotals = getSectionTotals(totals, section.code);
              return (
                <tr key={section.code}>
                  <td>{section.letter}</td>
                  <td>{section.label}</td>
                  <td>{resolveSectionReportNote(quote, section.code)}</td>
                  <td className="is-numeric">{formatQuoteCurrency(sectionTotals.subtotal)}</td>
                  <td className="is-numeric quote-print-extras">{formatQuoteCurrency(sectionTotals.extras)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="quote-print-summary">
          <dl className="quote-print-signatures">
            <div><dt>Quote Date:</dt><dd>{formatPrintDate(quote.quoteDate)}</dd></div>
            <div><dt>Validity:</dt><dd>{quote.validityDays} days</dd></div>
          </dl>
          <div className="quote-print-signature"><strong>Chimera Studio Srl</strong><span>Signature:</span></div>
          <div className="quote-print-signature"><strong>{quote.clientName}</strong><span>Signature:</span></div>
          <dl className="quote-print-grand-totals">
            <div>
              <dt><strong>SUB TOTAL</strong></dt>
              <dd><strong>{formatQuoteCurrency(totals.subtotal)}</strong></dd>
              <dd><strong>{formatQuoteCurrency(totals.extras)}</strong></dd>
            </div>
            <div>
              <dt>PRODUCTION FEE <strong>{formatNumber(quote.productionFeePct)}%</strong></dt>
              <dd><strong>{formatQuoteCurrency(totals.fee)}</strong></dd>
              <dd><strong>+IVA</strong></dd>
            </div>
            {totals.premium !== 0 ? (
              <div className={totals.premium > 0 ? 'is-premium' : 'is-discount'}>
                <dt><strong>{totals.premium > 0 ? 'PREMIUM' : 'DISCOUNT'}</strong></dt>
                <dd>{totals.premium > 0 ? '+' : ''}{formatQuoteCurrency(totals.premium)}</dd>
                <dd />
              </div>
            ) : null}
            <div className="is-total">
              <dt>TOTAL</dt>
              <dd>{formatQuoteCurrency(totals.total)}</dd>
              <dd>+IVA</dd>
            </div>
            <div>
              <dt><strong>TOTAL+IVA</strong></dt>
              <dd><strong>{formatQuoteCurrency(totals.totalWithVat)}</strong></dd>
              <dd />
            </div>
          </dl>
        </div>
        {quote.outputs.length > 0 ? (
          <div className="quote-print-outputs">
            <h3>OUTPUT</h3>
            <table className="quote-print-table">
              <thead>
                <tr>
                  <th>DELIVERY</th>
                  <th className="is-center">QT</th>
                  <th className="is-center">DURATION</th>
                  <th className="is-center">FORMAT</th>
                </tr>
              </thead>
              <tbody>
                {quote.outputs.map((output) => (
                  <tr key={output.id}>
                    <td>
                      <strong>{output.name}</strong>
                      {output.description ? <small>{output.description}</small> : null}
                    </td>
                    <td className="is-center">{formatNumber(output.qty)}</td>
                    <td className="is-center">{output.duration || '-'}</td>
                    <td className="is-center">{output.format || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <PrintFooterLogo />
      </section>
      {usedSections.map((section) => (
        <SectionPage key={section.code} quote={quote} totals={totals} section={section} />
      ))}
      <section className="quote-print-page quote-print-conditions">
        <PrintHeader quote={quote} heading="CONDIZIONI GENERALI" />
        {buildQuoteConditions(quote.paymentTerms).map((clause) => (
          <div key={clause.title} className="quote-print-clause">
            <h4>{clause.title}</h4>
            <p>{clause.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
