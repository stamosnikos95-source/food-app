# ADR 0003: Demand forecasting starts in the API, not a Python service

**Status**: Accepted (M7)
**Supersedes**: the "AI service (Python/FastAPI) for forecasting" part of ADR 0001 — for now.

## Context

The architecture proposal put demand forecasting in a separate Python service.
At M7 the business has no sales history yet: any learned model would be
fitting noise, while a second runtime adds a deploy target, cold starts,
inter-service auth and cost.

## Decision

Forecast inside the NestJS API with an explainable baseline
(`apps/api/src/modules/admin/operations/forecast.ts`, model `weekday-ewma-v1`):

- recency-weighted mean of the same weekday over the last 6 weeks (decay 0.75),
  falling back to the last 14 open days when a weekday has < 2 observations;
- recommended production = mean + z·spread, z = 0.5, reduced to 0.25 / 0 when
  more than 8% / 15% of the dish was left over in the last 14 days;
- only days the business was open count, and only since the dish was on the
  menu (a real 0 is not the same as no data);
- every prediction states its basis and a confidence level, and is stored in
  `demand_forecasts` (one row per dish per day, frozen once the day starts).

## Consequences

- Planning works from the first days of sales, with nothing extra to operate.
- Stored snapshots vs actual sales give a measured accuracy baseline. M10 should
  introduce a learned model (and the Python service, if warranted) only when it
  beats `weekday-ewma-v1` on that data. The interface is one pure function, so
  the swap is local.
