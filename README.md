# AI Alert Triage Agent

A production-style **alert triage** assistant: ingest an on-call alert, **classify** severity and domain, **find similar past incidents**, **pull a runbook**, and **draft notifications**—with **guardrails**, **structured JSON output**, and **full observability**. Built in **TypeScript** using **LangChain** and **LangGraph** so the workflow is explicit, testable, and easy to extend.

---

## Problem statement (business context)

Operations teams drown in noisy alerts. The cost is not only time—it is **wrong prioritization** (treating P4 noise like P1 fire) and **slow coordination** (no shared runbook, no draft comms). This project demonstrates an **agentic workflow** that turns a raw alert into a **decision-ready package**: classification, historical context, actionable steps, and draft Slack/email copy—so humans spend seconds on judgment, not minutes on assembly.

---

## What the agent does (scope)

**In scope**

- Multi-step **orchestration** (not a single mega-prompt): classify → similar incidents → runbook → notification draft.
- **Tools / functions**: local similarity search over incident history, runbook lookup, LLM-based classification and drafting (structured outputs).
- **Outputs**: validated **JSON** (`TriageReport`) plus a **human-readable `summary`** string.
- **Guardrails**: pattern-based blocking of obvious prompt-injection style content; sanitization warnings; safe system prompts.
- **Reliability**: retries on LLM calls (`p-retry`), graceful fallbacks when classification or drafting fails after retries.
- **Observability**: structured logging (**Pino**) and a **tool trace** (`steps_trace`) aligned with each step.

**Out of scope (by design for this demonstration)**

- **No live database**: incident and runbook data ship as **JSON fixtures** under `src/data/` to keep the demo **fast to run, fork, and test**—like using a **catalog** instead of wiring a warehouse on day one.
- **No ticketing / paging integrations** (Jira, PagerDuty APIs): the output is **draft** text you could paste or connect later.
- **No continuous learning** from production feedback in this repo.

---

## Business cases covered

| Scenario                           | Behavior                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Typical infra / app alert          | Full pipeline: classification → similar incidents → runbook → drafts.                                           |
| Suspicious / injection-like text   | **Blocked** before LLM calls where patterns match guardrails.                                                   |
| LLM provider errors or rate limits | **Retries**, then **fallback** classification and notification copy so the run still returns a coherent report. |

---

## Why LangChain + LangGraph (framework choice)

Think of **LangChain** as the **standard toolkit** for LLM applications: prompts, structured output, and **pluggable model backends**—the same way a logistics company standardizes on pallets and containers so you can **swap trucks** without redesigning the warehouse.

We pair it with **LangGraph** for **orchestration**: a **directed workflow** (state machine) where each step has a clear input/output. That is closer to how real on-call runbooks work than a single opaque prompt—more **assembly line** than **one black box**.

**Why not a heavier proprietary stack for a demo?** LangChain is **widely adopted**, **well documented**, and **model-agnostic**—we can point the same graph at **Google Gemini**, **Anthropic**, or **OpenAI** by configuration, which mirrors how teams **hedge vendor risk** in production.

---

## Model / provider choice

The code uses a **single abstraction** (`BaseChatModel`) with **provider-specific** implementations:

| Provider                           | Default model (override via env) | Typical use                                                                           |
| ---------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| **Gemini** (`LLM_PROVIDER=gemini`) | `gemini-2.0-flash`               | Strong **cost/latency** profile for demos and high-volume classification-style tasks. |
| **Anthropic**                      | `claude-haiku-4-5`               | When you want **Claude** in the loop with the same graph.                             |
| **OpenAI**                         | `gpt-4o-mini`                    | Familiar OpenAI path; good for **structured JSON** at modest cost.                    |

**Analogy:** the **workflow** is the factory floor; the **LLM provider** is which **power plant** feeds it. We standardized the **plugs** so you can change the plant without rebuilding the floor.

Default in `.env.example` is **Gemini** so evaluators can run with **one key** and sensible defaults. **You only need the API key for the provider you select.**

---

## Architecture overview

```
CLI / library entry
    → Guardrails (sanitize / block)
    → LangGraph state: alert → classification → incidents → runbook → notification → report
         ├── LLM: classify (structured)
         ├── Tool: search similar incidents (JSON fixtures)
         ├── Tool: get runbook (JSON fixtures)
         └── LLM: draft notifications (structured)
    → Zod-validated TriageReport + summary
    → Pino logs + optional trace file
```

**Data flow:** raw alert JSON → validated `AlertInput` → sanitized text → graph nodes update **shared state** → final **`TriageReport`** JSON.

---

## Code style and engineering

- **TypeScript** with **strict** typing, **ESM** (`NodeNext`), **Zod** for runtime validation at boundaries.
- **ESLint** + **Prettier** (`pnpm run check`).
- **Pino** for production-grade structured logs; **p-retry** for LLM retries (no hand-rolled retry loops).
- **Vitest** for unit and integration tests; LLM **mocked** in tests so **CI does not require paid API access**.

---

## Setup (local run)

**Prerequisites:** Node 20+, `pnpm`.

```bash
pnpm install
cp .env.example .env
# Set LLM_PROVIDER and the matching API key (see .env.example)
pnpm run build
```

**Run a full CLI triage** (default sample `samples/alert-p2.json`):

```bash
pnpm start
```

**Economical demo** (short `samples/demo-alert.json`):

```bash
pnpm demo
```

**Environment variables** (see `.env.example`):

- `LLM_PROVIDER` — `gemini` | `anthropic` | `openai` (aliases: `google`, `claude`, `chatgpt`).
- `GOOGLE_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — only the **active** provider’s key is required.
- Optional: `LOG_LEVEL`, `SAVE_TRACE`, `TRACE_DIR`, `DEMO`, `DEMO_MODE`.

---

## How to test / verify

**Automated (no API key required for default test run):**

```bash
pnpm test
pnpm run check   # typecheck + lint + format
```

Tests **mock** the LLM module so they stay **offline and free**. Integration tests exercise the **same path as the CLI** (`runTriageFromSamplePath`) with fixtures.

**Manual scenarios**

1. **Happy path:** `pnpm demo` or `pnpm start` with a valid key → expect JSON report on stdout and Pino lines on stderr/stdout (see logging note below).
2. **Guardrails:** run with `samples/alert-injection.json` (or similar) → expect **rejection** before LLM calls.
3. **Provider swap:** set `LLM_PROVIDER=openai` and `OPENAI_API_KEY` → same graph, different backend.

---

## Example inputs / outputs

**Inputs:** JSON files under `samples/` (e.g. `demo-alert.json`, `alert-p2.json`, `alert-injection.json`). Each file must satisfy `AlertInputSchema` (`raw_text` length limits, etc.).

**Output:** A single **`TriageReport`** JSON object printed at the end of a CLI run, including:

- `severity`, `category`, `confidence`, `root_cause_hypothesis`
- `similar_incidents`, `runbook_steps`, `escalate_to`, `estimated_resolution_minutes`
- `slack_draft`, **`summary`** (human-readable narrative)
- `duration_ms`, **`steps_trace`** (successful tool names for observability)

### Illustrative log excerpt (successful LLM calls)

The following is a **documentation example** of what a **successful** run looks like when the provider accepts requests (structured Pino JSON, one line per log entry). It is **representative** of the real format your code emits; timestamps and IDs will differ each run.

```text
{"level":30,"context":"AGENT","msg":"Step 1/4: Classifying alert..."}
{"level":30,"context":"TOOL","tool":"classifyAlert","msg":"-> classifyAlert"}
{"level":30,"context":"TOOL","tool":"classifyAlert","msg":"[ok] classifyAlert completed"}
{"level":30,"context":"AGENT","msg":"Step 2/4: Searching similar incidents..."}
{"level":30,"context":"TOOL","tool":"searchSimilarIncidents","msg":"[ok] searchSimilarIncidents completed"}
{"level":30,"context":"AGENT","msg":"Step 3/4: Fetching runbook..."}
{"level":30,"context":"TOOL","tool":"getRunbook","msg":"[ok] getRunbook completed"}
{"level":30,"context":"AGENT","msg":"Step 4/4: Drafting notification..."}
{"level":30,"context":"TOOL","tool":"draftNotification","msg":"[ok] draftNotification completed"}
```

**Illustrative JSON snippet (success path):**

```json
{
  "alert_id": "INC-…",
  "severity": "P2",
  "category": "infra",
  "confidence": 0.82,
  "root_cause_hypothesis": "Elevated CPU on prod-api; consistent with capacity saturation.",
  "similar_incidents": [{ "id": "INC-2024-004", "title": "…", "resolution_summary": "…" }],
  "runbook_steps": ["…"],
  "escalate_to": "backend-team",
  "estimated_resolution_minutes": 45,
  "slack_draft": "…",
  "summary": "[P2] INFRA incident detected. … Triage completed in 2.1s.",
  "duration_ms": 2100,
  "steps_trace": ["classifyAlert", "searchSimilarIncidents", "getRunbook", "draftNotification"]
}
```

### When the provider rejects the request (e.g. insufficient credits)

If the API returns an error (as in a **billing / quota** failure), you will see **`[fail]`** on `classifyAlert` and/or `draftNotification`, **`level` 40–50** lines with the provider error body, and the pipeline **still completes** using **fallback** classification and notification text. In that case **`steps_trace`** may only list tools that **succeeded** (e.g. `searchSimilarIncidents`, `getRunbook`)—which is **by design**: the trace reflects **successful** tool completions for downstream auditing.

---

## Trade-offs, limitations, and next steps

| Trade-off                                              | Rationale                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| JSON fixtures vs database                              | **Speed** and **zero infra** for reviewers; swap in Postgres/Elastic later.       |
| Fixed LangGraph vs fully autonomous tool-picking agent | **Predictable** steps for on-call workflows; easier to test and explain.          |
| Pattern-based guardrails vs full ML safety stack       | **Pragmatic** baseline; production would add allowlists, RBAC, and review queues. |

**Next steps for production:** real incident store, secrets management, LangSmith or equivalent tracing, human-in-the-loop approval for outbound messages, rate limits, and compliance logging.

---

## Real-world usage

**Is this solution currently used in any business?**

**Not in production today.** This repository is a **demonstration** for an engineering assessment.

**Who could use it tomorrow**

- **SaaS platform teams** running 24/7 on-call with repetitive alert noise.
- **Fintech / payment** operations needing **consistent severity** and **audit-friendly** outputs.
- **Internal developer platforms** offering a **standard triage** microservice in front of PagerDuty or Opsgenie.

**To productionize:** enterprise SSO and secrets, durable queues, **human approval** for customer-facing text, **data residency**, integration with real CMDB and ticketing, **SLO-based** routing, and **continuous evaluation** of classification quality.

---

**CI:** GitHub Actions runs **`pnpm run check`** (typecheck, ESLint, Prettier) and **`pnpm test`** on every **push to `main`** and on **all pull requests** (see `.github/workflows/ci.yml`).

---

## License

ISC
