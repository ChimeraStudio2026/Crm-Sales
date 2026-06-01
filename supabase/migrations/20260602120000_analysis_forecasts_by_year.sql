-- Previsioni Analisi distinte per anno (2025 / 2026)
alter table public.analysis_forecasts
    drop constraint if exists analysis_forecasts_pkey;

alter table public.analysis_forecasts
    add constraint analysis_forecasts_pkey primary key (scope, year);
