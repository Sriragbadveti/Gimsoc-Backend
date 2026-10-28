# Load tests

Runs the real backend against a local MongoDB 8 replica set (single node, 2 vCPU, load generator on the same box), seeded with 1,200 tickets. Only outbound email and the per-IP rate limiter are stubbed (all test traffic comes from 127.0.0.1).

```
node tests/load/bench.js . baseline   # writes results-<label>.json
node tests/load/functional.js        # behaviour checks
```

| Scenario | Before | After |
|---|---|---|
| Workshop seat rush: 150 attendees, 40-seat sessions | 145 × HTTP 500, 5/40 seats filled | 40 × 200, 110 × 409 "full", 40/40 filled, 0 errors |
| Workshop rush p95 latency | 1632 ms | 1453 ms |
| Ticket cap race: 80 buyers, 14 tickets left (cap 200) | 266 sold → oversold by 66 | 200 sold → oversold by 0 (66 × 409 sold out) |
| Same email submitted 10× at once | 6 tickets created | 1 ticket created |
| GET /gala-availability, 100 connections | 435 req/s, p50 220 ms | 2272 req/s, p50 39 ms |
| GET /admin/ticket-summary, 20 connections | 52 req/s, p50 382 ms | 64 req/s, p50 297 ms |

Raw numbers: `results-baseline.json`, `results-after.json`. Absolute latencies are bound by the 2-core test machine; the correctness results (seats, oversell, duplicates) are what matter.
