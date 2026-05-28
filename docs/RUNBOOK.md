# Runbook — hosted demo endpoint

Operational notes for the Cloud Function deploy. The README has the visitor-facing version; this file is the operator-facing version.

## Cost posture

Comfort budget: **~€25/month**. Past that, look at whether to tighten limits or upgrade the comfort zone.

| Daily volume | Monthly total | Estimated cost |
|---|---|---|
| 20k/day | ~600k | ~€7 |
| 40k/day | ~1.2M | ~€14 |
| 60k/day | ~1.8M | ~€21 |
| 75k/day | ~2.3M | ~€25 (comfort grenze) |

The dominant cost is Cloud Run compute (vCPU + memory seconds). Free tier covers ~25k requests/month before charges start.

## Protection layers

Three preventive, one manual. No budget alerts, no programmatic billing-shutoff — overhead doesn't earn its keep at this scale.

| Layer | What | Where |
|---|---|---|
| `maxInstances: 3` | Caps concurrent compute / blast-radius | [src/functions.ts](../src/functions.ts) |
| In-memory daily counter | ~25k requests per instance per UTC day, returns 429 past that | [src/middleware/daily-cap.ts](../src/middleware/daily-cap.ts) |
| Per-(IP, UA) rate limit | 30/min, express-rate-limit, in-memory per instance | [src/middleware/rate-limit.ts](../src/middleware/rate-limit.ts) |
| **Kill switch** (manual) | `firebase functions:delete mcp` — nukes the endpoint | This file |

The daily counter is *per instance*. With Cloud Run roughly load-balancing across 3 instances, the effective cap is ~75k/day ± instance churn. Imperfect by design — exact accounting via Firestore would cost ~€7/month for the bookkeeping itself.

## Emergency kill switch

If the endpoint is being abused, costing too much, or behaving strangely:

```sh
# Nuke completely
firebase functions:delete mcp --project <project-id>

# Softer: deploy a no-op
# (edit src/functions.ts to return 503, then npm run deploy)
```

You can redeploy at any time with `npm run deploy`.

## Logging and analytics

All structured logs go to Cloud Logging. Useful events emitted by the server:

| Event | When | Fields |
|---|---|---|
| `http.request` | Each `/mcp` request | `requestId`, `ip`, `ua`, `method`, `path` |
| `http.response` | End of request | `requestId`, `statusCode`, `durationMs` |
| `tool.invoked` | Per tool call | `tool`, `queryIntent`, `status`, `durationMs` |
| `ratelimit.blocked` | Rate-limit kick-in | `ip`, `ua`, `windowMs`, `limit` |

### Useful queries (Cloud Logging Explorer)

Unique visitors last 7 days:

```
resource.type="cloud_run_revision"
resource.labels.service_name="mcp"
jsonPayload.event="http.request"
timestamp >= timestamp_sub(@now, INTERVAL 7 DAY)
```

Then group by `jsonPayload.ip` in the UI.

Tool-popularity ranking:

```
jsonPayload.event="tool.invoked"
```

Then group by `jsonPayload.tool`.

### Log-based Metrics (optional, configured in Cloud Logging UI)

| Metric name | Filter | Use |
|---|---|---|
| `unique_callers_daily` | `jsonPayload.event="http.request"` | Distinct count over `jsonPayload.ip` |
| `requests_total` | `jsonPayload.event="http.request"` | Total traffic |
| `tool_invocations` | `jsonPayload.event="tool.invoked"` | Label on `jsonPayload.tool` |

## Privacy

The endpoint logs raw IP and User-Agent. Cloud Run / Cloud Logging would log `httpRequest.remoteIp` automatically regardless of what the application does, so hashing in application logs would only obscure analytics queries without adding privacy. Retention follows Cloud Logging defaults (30 days).

Legal basis: legitimate interest (abuse prevention + usage analytics for a paper-companion demo). Contact via the GitHub issues tracker for scrubbing requests.

## Secret rotation

The EP-Online API key is stored in GCP Secret Manager via Firebase. To rotate:

```sh
firebase functions:secrets:set EP_ONLINE_API_KEY  # paste new value
npm run deploy                                    # pin function to new secret version
```

The application code reads `process.env.EP_ONLINE_API_KEY` — same path locally (via `.env`) and in the cloud.

## First-time deploy checklist

1. Create Firebase project at https://console.firebase.google.com
2. Upgrade to Blaze (pay-as-you-go); Cloud Functions v2 + Secret Manager require it
3. Enable APIs: Cloud Functions, Cloud Run, Secret Manager, Cloud Build
4. Update [.firebaserc](../.firebaserc) — replace `TODO-firebase-project-id` with your project ID
5. `firebase login` then `firebase use <project-id>`
6. `npm run deploy:setup-secret` — paste your EP-Online API key
7. `npm run deploy`
8. Note the hosted URL Firebase prints — paste into the README's "Try the hosted demo" section
