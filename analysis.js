/**
 * CRM Sales — Sezione Analisi (OKR, previsioni, quarter)
 */
const CrmAnalysis = (function createCrmAnalysisModule() {
    const ANALYSIS_YEAR = 2026;
    const ANALYSIS_SCOPES = [
        { id: 'total', label: 'Totale Anno', isQuarter: false, alwaysOpen: true },
        { id: 'q1', label: 'Q1 — Gen · Feb · Mar', isQuarter: true, quarter: 1 },
        { id: 'q2', label: 'Q2 — Apr · Mag · Giu', isQuarter: true, quarter: 2 },
        { id: 'q3', label: 'Q3 — Lug · Ago · Set', isQuarter: true, quarter: 3 },
        { id: 'q4', label: 'Q4 — Ott · Nov · Dic', isQuarter: true, quarter: 4 }
    ];
    const PRODUCT_CATEGORIES = ['Prod', 'Mini Prod', 'Content', 'Evento'];
    const RELATIONSHIP_ROWS = [
        { key: 'Nuovo Cliente', label: 'New' },
        { key: 'Ricorrente', label: 'Ricorrente' },
        { key: 'Top 20%', label: 'Top 20%' }
    ];
    const CLIENT_TYPE_ROWS = [
        'Cliente Diretto', 'Agenzia', 'Agenzia PR', 'CDP', 'Agenzia Eventi'
    ];

    function createDefaultForecasts() {
        const forecasts = {};
        ANALYSIS_SCOPES.forEach((scope) => {
            forecasts[scope.id] = { totalForecast: 0, productPct: {} };
            PRODUCT_CATEGORIES.forEach((cat) => {
                forecasts[scope.id].productPct[cat] = 0;
            });
        });
        return forecasts;
    }

    function normalizeProductType(raw) {
        const value = String(raw || '').trim().toLowerCase();
        if (!value) return 'Content';
        if (value.includes('big') || value.includes('motion') || value === 'prod') return 'Prod';
        if (value.includes('mini')) return 'Mini Prod';
        if (value.includes('event')) return 'Evento';
        if (value.includes('content')) return 'Content';
        return 'Content';
    }

    function parseQuarterFromMonth(raw) {
        if (raw === undefined || raw === null || raw === '') return 0;
        const text = String(raw).trim().toLowerCase();
        if (!text) return 0;
        if (text.includes('q1') || text === '1') return 1;
        if (text.includes('q2') || text === '2') return 2;
        if (text.includes('q3') || text === '3') return 3;
        if (text.includes('q4') || text === '4') return 4;
        const monthMap = {
            gennaio: 1, gen: 1, febbraio: 2, feb: 2, marzo: 3, mar: 3,
            aprile: 4, apr: 4, maggio: 5, mag: 5, giugno: 6, giu: 6,
            luglio: 7, lug: 7, agosto: 8, ago: 8, settembre: 9, set: 9,
            ottobre: 10, ott: 10, novembre: 11, nov: 11, dicembre: 12, dic: 12
        };
        if (monthMap[text]) return Math.ceil(monthMap[text] / 3);
        const numeric = parseInt(text, 10);
        if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= 12) {
            return Math.ceil(numeric / 3);
        }
        return 0;
    }

    function filterOkrByScope(records, scopeDef) {
        if (scopeDef.id === 'total') return records.filter((r) => r.year === ANALYSIS_YEAR);
        return records.filter((r) => r.year === ANALYSIS_YEAR && r.quarter === scopeDef.quarter);
    }

    function findClientForOkr(clientName, clients) {
        const normalized = clientName.trim().toLowerCase();
        return clients.find((c) => c.name.trim().toLowerCase() === normalized) || null;
    }

    function sumAmount(records) {
        return records.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
    }

    function formatPct(value) {
        const num = Number(value) || 0;
        const sign = num > 0 ? '+' : '';
        return `${sign}${num.toFixed(2)}%`;
    }

    function formatPctPlain(value) {
        return `${(Number(value) || 0).toFixed(2)}%`;
    }

    function buildProductStats(records, forecastScope) {
        const total = sumAmount(records);
        return PRODUCT_CATEGORIES.map((category) => {
            const categoryRecords = records.filter((r) => r.productType === category);
            const revenue = sumAmount(categoryRecords);
            const count = categoryRecords.length;
            const revenuePct = total > 0 ? (revenue / total) * 100 : 0;
            const forecastPct = Number(forecastScope.productPct[category]) || 0;
            const deltaPct = revenuePct - forecastPct;
            const ticketMedio = count > 0 ? revenue / count : 0;
            return {
                category,
                revenue,
                revenuePct,
                forecastPct,
                deltaPct,
                ticketMedio,
                count
            };
        });
    }

    function buildGroupedStats(records, clients, groupKeyFn, rows) {
        const total = sumAmount(records);
        return rows.map((row) => {
            const key = typeof row === 'string' ? row : row.key;
            const label = typeof row === 'string' ? row : row.label;
            const scoped = records.filter((r) => {
                const client = findClientForOkr(r.clientName, clients);
                if (!client) return false;
                return groupKeyFn(client) === key;
            });
            const revenue = sumAmount(scoped);
            return {
                label,
                revenue,
                revenuePct: total > 0 ? (revenue / total) * 100 : 0
            };
        });
    }

    function buildScopeMetrics(records, forecastScope) {
        const total = sumAmount(records);
        const forecast = Number(forecastScope.totalForecast) || 0;
        return { total, forecast, delta: total - forecast };
    }

    function buildKpiCardsHtml(scopeId, metrics) {
        const forecastInput = scopeId === 'total'
            ? `<input type="number" class="analysis-forecast-input" data-scope="${scopeId}" data-field="totalForecast" value="${metrics.forecast || ''}" min="0" step="100" placeholder="0">`
            : `<input type="number" class="analysis-forecast-input" data-scope="${scopeId}" data-field="totalForecast" value="${metrics.forecast || ''}" min="0" step="100" placeholder="0">`;
        const deltaClass = metrics.delta >= 0 ? 'analysis-kpi-positive' : 'analysis-kpi-negative';
        return `
            <div class="analysis-kpi-grid">
                <div class="analysis-kpi-card">
                    <span class="analysis-kpi-label">Totale OKR</span>
                    <strong class="analysis-kpi-value">${window.formatCurrency(metrics.total)}</strong>
                    <span class="analysis-kpi-hint">Somma OKR importati da Excel</span>
                </div>
                <div class="analysis-kpi-card">
                    <span class="analysis-kpi-label">Previsione</span>
                    ${forecastInput}
                    <span class="analysis-kpi-hint">Inserimento manuale</span>
                </div>
                <div class="analysis-kpi-card">
                    <span class="analysis-kpi-label">Delta</span>
                    <strong class="analysis-kpi-value ${deltaClass}">${window.formatCurrency(metrics.delta)}</strong>
                    <span class="analysis-kpi-hint">Totale − Previsione</span>
                </div>
            </div>`;
    }

    function buildProductTableHtml(scopeId, productStats) {
        const body = productStats.map((row) => `
            <tr>
                <td><strong>${row.category}</strong></td>
                <td class="analysis-num">${window.formatCurrency(row.revenue)}</td>
                <td class="analysis-num">${formatPctPlain(row.revenuePct)}</td>
                <td class="analysis-num">
                    <input type="number" class="analysis-pct-input" data-scope="${scopeId}" data-product="${row.category}" value="${row.forecastPct || ''}" min="0" max="100" step="0.01" placeholder="0">%
                </td>
                <td class="analysis-num ${row.deltaPct >= 0 ? 'analysis-kpi-positive' : 'analysis-kpi-negative'}">${formatPct(row.deltaPct)}</td>
                <td class="analysis-num">${window.formatCurrency(row.ticketMedio)}</td>
                <td class="analysis-num">${row.count}</td>
            </tr>
        `).join('');
        return `
            <div class="analysis-table-block">
                <h4 class="analysis-table-title">Tipi di progetti</h4>
                <div class="analysis-table-wrap">
                    <table class="analysis-table">
                        <thead>
                            <tr>
                                <th>Categoria</th>
                                <th>Fatturato</th>
                                <th>Fatturato %</th>
                                <th>Previsione %</th>
                                <th>Delta %</th>
                                <th>Ticket Medio</th>
                                <th>N. Prop</th>
                            </tr>
                        </thead>
                        <tbody>${body}</tbody>
                    </table>
                </div>
            </div>`;
    }

    function buildSimpleTableHtml(title, rows, totalRevenue) {
        const body = rows.map((row) => `
            <tr>
                <td>${row.label}</td>
                <td class="analysis-num">${window.formatCurrency(row.revenue)}</td>
                <td class="analysis-num">${formatPctPlain(row.revenuePct)}</td>
            </tr>
        `).join('');
        return `
            <div class="analysis-table-block">
                <h4 class="analysis-table-title">${title}</h4>
                <p class="analysis-table-sub">Fatturato da OKR Excel, categorizzato tramite anagrafica clienti CRM.</p>
                <div class="analysis-table-wrap">
                    <table class="analysis-table analysis-table-simple">
                        <thead>
                            <tr>
                                <th>Categoria</th>
                                <th>Fatturato</th>
                                <th>Fatturato %</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="analysis-row-total">
                                <td><strong>TOTALI</strong></td>
                                <td class="analysis-num"><strong>${window.formatCurrency(totalRevenue)}</strong></td>
                                <td class="analysis-num"><strong>100%</strong></td>
                            </tr>
                            ${body}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }

    function buildScopeContentHtml(scopeDef, records, forecasts, clients) {
        const forecastScope = forecasts[scopeDef.id] || createDefaultForecasts()[scopeDef.id];
        const metrics = buildScopeMetrics(records, forecastScope);
        const productStats = buildProductStats(records, forecastScope);
        const relationshipStats = buildGroupedStats(
            records,
            clients,
            (client) => client.relationship,
            RELATIONSHIP_ROWS
        );
        const clientTypeStats = buildGroupedStats(
            records,
            clients,
            (client) => client.type,
            CLIENT_TYPE_ROWS
        );
        const totalRevenue = metrics.total;
        return `
            ${buildKpiCardsHtml(scopeDef.id, metrics)}
            ${buildProductTableHtml(scopeDef.id, productStats)}
            ${buildSimpleTableHtml('Tipi di clienti — Rapporto', relationshipStats, totalRevenue)}
            ${buildSimpleTableHtml('Tipi di clienti — Tipologia CRM', clientTypeStats, totalRevenue)}
        `;
    }

    function renderDashboard(container, deps) {
        if (!container) return;
        const { okrRecords, analysisForecasts, analysisExpanded, clients } = deps;
        const totalScope = ANALYSIS_SCOPES[0];
        const totalRecords = filterOkrByScope(okrRecords, totalScope);
        const quarterScopes = ANALYSIS_SCOPES.filter((s) => s.isQuarter);
        const totalContent = buildScopeContentHtml(totalScope, totalRecords, analysisForecasts, clients);
        const quarterHtml = quarterScopes.map((scopeDef) => {
            const isOpen = analysisExpanded.has(scopeDef.id);
            const scopedRecords = filterOkrByScope(okrRecords, scopeDef);
            const content = buildScopeContentHtml(scopeDef, scopedRecords, analysisForecasts, clients);
            return `
                <div class="analysis-accordion ${isOpen ? 'is-open' : ''}" data-scope="${scopeDef.id}">
                    <button type="button" class="analysis-accordion-toggle" data-action="toggle-analysis-scope" data-scope="${scopeDef.id}">
                        <i data-lucide="chevron-right" class="analysis-accordion-icon"></i>
                        <span>${scopeDef.label}</span>
                        <span class="analysis-accordion-meta">${window.formatCurrency(sumAmount(scopedRecords))} · ${scopedRecords.length} OKR</span>
                    </button>
                    <div class="analysis-accordion-body">${content}</div>
                </div>`;
        }).join('');
        container.innerHTML = `
            <div class="analysis-intro glass-card">
                <h3><i data-lucide="bar-chart-3"></i> Analisi ${ANALYSIS_YEAR}</h3>
                <p>I dati di fatturato e N. Prop derivano dagli OKR importati via Excel (Importo, Prodotto, Mese). Big Prod e Motion sono unificati in <strong>Prod</strong>. Le previsioni sono modificabili manualmente.</p>
                ${okrRecords.length === 0 ? '<p class="analysis-empty-hint">Nessun OKR caricato — importa un file Excel dalla sezione Importa Excel.</p>' : ''}
            </div>
            <div class="analysis-block analysis-block-total is-open">
                <div class="analysis-block-header">
                    <h3><i data-lucide="layers"></i> Totale Anno ${ANALYSIS_YEAR}</h3>
                    <span class="quick-stats-badge">${okrRecords.length} OKR totali</span>
                </div>
                <div class="analysis-block-body">${totalContent}</div>
            </div>
            <div class="analysis-quarters">${quarterHtml}</div>
        `;
        if (typeof window.safeCreateIcons === 'function') window.safeCreateIcons();
    }

    return {
        ANALYSIS_YEAR,
        ANALYSIS_SCOPES,
        PRODUCT_CATEGORIES,
        createDefaultForecasts,
        normalizeProductType,
        parseQuarterFromMonth,
        filterOkrByScope,
        renderDashboard
    };
})();
