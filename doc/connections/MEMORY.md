# Experimental memory connectors

Enable **Settings → Experimental → Memory connectors**, then open **Connectors**
and choose Mem0, Zep, Supermemory, Cognee, or Honcho. The flag defaults to off.
It hides catalog setup and rejects curated setup, reconnect, and OAuth-start
requests on the server. Existing connections remain available and keep running.
Generic custom MCP connections retain their existing behavior.

These are ordinary company-scoped tool connections. There is no separate memory
page, automatic conversation upload, prompt injection, or background memory sync.
Agents explicitly invoke the provider's tools through the existing gateway, and
operators manage access and actions on the regular Permissions screen.

## Provider contracts

Official documentation and public endpoint discovery checked September 24, 2026.

| Provider | Transport and authentication | Setup and scope |
| --- | --- | --- |
| [Mem0](https://docs.mem0.ai/platform/mem0-mcp) | Remote MCP, `https://mcp.mem0.ai/mcp/`, Bearer API key | Create a key in the Mem0 dashboard. The provider key controls project access; user/agent/session selectors are tool arguments. |
| [Zep](https://help.getzep.com/memory-mcp-server) | Remote MCP, `https://api.getzep.com/mcp`, OAuth | Configure Memory MCP and the identity provider in Zep first. A project administrator assigns MCP seats and shared graphs. Sign in with the assigned work identity. An ordinary Zep API key is not the credential for this endpoint. |
| [Supermemory](https://supermemory.ai/docs/supermemory-mcp/mcp) | Remote MCP, `https://mcp.supermemory.ai/mcp`, OAuth | Sign in and select the workspace, read/write access, and optional container tags offered by Supermemory. Developer API keys are separate from hosted MCP sign-in. |
| [Cognee](https://docs.cognee.ai/cognee-cloud/connections/cloud-mcp) | Approved local stdio client, Cloud API key | Copy the tenant API Base URL and key from Cognee Cloud → API Keys. Requires an active Cloud workspace and `uv` on the runtime host. Public deployments require the existing trusted MCP runtime host. |
| [Honcho](https://honcho.dev/docs/v3/guides/integrations/mcp) | Remote MCP, `https://mcp.honcho.dev`, Bearer API key | Create an organization and API key in the Honcho dashboard. Workspace, peer, and session selectors remain explicit provider tool arguments. |

Zep and Supermemory use user grants, the existing PKCE OAuth broker, and automatic
client registration/discovery. Zep advertises its authorization server at
`https://api.getzep.com/v1/oauth`, with `graph:read graph:write` scopes.
Supermemory advertises `https://api.supermemory.ai/api/auth`, with
`openid profile email offline_access`. Neither requires Paperclip ID or a new
Paperclip-hosted credential service.

Cognee does not advertise a hosted MCP endpoint. Its approved template runs
`uvx --from cognee-mcp==0.5.5 cognee-mcp`. The published package's remote API mode
receives only `COGNEE_BASE_URL` and `COGNEE_API_KEY` from encrypted credential
references. The base URL must be an HTTPS tenant origin under `*.aws.cognee.ai`;
credentials, ports, paths, query strings, and fragments are rejected. Setup and
health verify the key with the Cloud datasets endpoint using the guarded HTTP
client. That verifies Cloud access; the runtime still needs a working `uvx`
installation and access to the official package registry on first launch. Prewarm
with `uvx --from cognee-mcp==0.5.5 cognee-mcp --help`; the initial dependency
download can take several minutes. Calls without an explicit timeout receive
60 seconds for client startup and retrieval synthesis. Memory indexing is
asynchronous: an immediate recall after remember may return HTTP 409 until the
dataset is ready. The gateway recognizes the pinned client's text-only failure
responses and records them as errors, rather than successful tool calls.

## Credential and governance boundaries

API keys and OAuth tokens use the instance vault and existing grant lifecycle.
Cognee's tenant URL is displayed as text during entry but is also vaulted, with
an `env.COGNEE_BASE_URL` reference. No credential value belongs in connection
config, manifests, logs, fixtures, or Storybook. Personal credentials stay on
personal grants; organization credentials stay on the organization grant.
The local stdio gateway projects only the approved template's environment keys.

Provider resource selectors are not new Paperclip-enforced tenant filters. The
provider's key, OAuth consent, and ACLs determine its accessible data. Configure
agent access and action policies accordingly; do not claim that a user ID,
workspace name, dataset, or space argument by itself enforces isolation.

The catalog classifies memory retrieval as read, storage/update as write, and
forget/delete/reset as destructive, overriding misleading read-only hints.
Unknown actions are treated as writes. Supermemory's `add_memory` can either
save or forget, so the whole action is destructive. Cognee exposes only the
reviewed `remember`, `recall`, and `forget` schemas from version 0.5.5, not the
package's broader administration tools.

| Reviewed family | Examples | Risk |
| --- | --- | --- |
| Retrieval | Mem0 `search_memories`, `get_memories`, `list_events`; Supermemory `search_memory`, `get_profile`; Cognee `recall` | Read |
| Store/update | Mem0 `add_memory`, `update_memory`; Zep add-memory tools; Cognee `remember`; Honcho create/update tools | Write |
| Delete/forget | Mem0 `delete_memory`, `delete_all_memories`, `delete_entities`; Supermemory `add_memory`; Cognee `forget` | Destructive |

The existing default policy remains **Allowed** for active actions, including
writes and deletion. Operators can narrow access or set **Ask first**. Connection
revocation, company and grant checks, action profiles, runtime access, catalog
quarantine (when enabled), and audit continue through the shared substrate.

## Review and validation

Storybook: **Apps → Connections → Memory**. Includes all five production setup
flows, the experimental toggle, disabled setup, waiting for sign-in, rejected
credentials/retry, and a narrow Cognee layout. The fixtures explicitly simulate
authentication/discovery and never call providers or store secrets.

Deterministic tests cover the off-by-default contract, cached gallery filtering,
direct setup links, server-side gates before secret creation, provider methods,
environment credential paths, risk classification, pinned Cognee schemas, URL
restrictions, and encrypted credential handling. Full provider proof is tracked
separately below; mocked tests and Storybook are not live proof.

The [sanitized live tool inventory](memory-tool-inventory.json) records every
discovered name, schema hash, parameter name, and risk classification for the
three connected providers. Zep and Honcho have no authenticated inventory yet.

Live observations from the isolated `codex/memory-connectors` checkout:

- Mem0: API key created; live setup discovered 11 tools. Search succeeded through
  Paperclip. An `add_memory` call with synthetic notebook text waited for **Ask
  first**, then executed after **Allow once**, with both decisions in the audit log.
- Supermemory: Google sign-in and developer API key creation completed. Hosted
  MCP OAuth connected separately with read-only consent restricted to the test
  tag and one test agent. Search succeeded; a query for an unconsented tag
  returned the expected provider denial. Live discovery returned 16 tools.
- Cognee: API key created and Cloud access verified. The official pinned MCP
  client stored synthetic notebook text in a dedicated test dataset and recalled
  it after indexing completed. Personal setup exposes the three reviewed tools.
  Paperclip gateway recall returned the expected blue notebook fact (10.6s).
  A nonexistent test dataset returned a tool error, correctly recorded as failure.
- Zep: Google sign-in reached “Account not found”; account creation is pending.
- Honcho: Google sign-in succeeded, but organization onboarding repeatedly returned
  “Could not create your organization. Please try again.” No key could be created.

Zep and Honcho remain unverified against authenticated provider accounts. Public
protocol discovery and deterministic fixtures do not replace that live proof.
No real memories were uploaded for testing. The synthetic Cognee dataset is
`paperclip_memory_connector_smoke_20260924`; the Mem0 test user and Supermemory
consent tag are `paperclip-memory-smoke-20260924`.

### Real agent tasks

Follow-up acceptance testing creates tasks in the browser and assigns a real
`codex_local` agent in an isolated company. These tests use managed connector
tools, not provider credentials in the agent environment. Task-scoped connector
audit records verify the returned provider results independently of the agent's
completion comment.

The first task exposed a Codex delivery defect: generated MCP config used
`headers`, which Codex ignores, instead of `http_headers`. The adapter now writes
the supported field; a regression assertion checks the complete header setting.
After restarting the test server, the resumed agent received working managed
tools and retrieved the approved Mem0 memory.

- **MEM-1 / Mem0:** browser-created task requested a synthetic write, paused for
  **Ask first**, and resumed after the board clicked **Approve & run**. The write
  executed once and `search_memories` retrieved the same memory ID and exact
  silver compass fact under user `paperclip-memory-task-e2e-20260924`.
- **MEM-2 / Cognee:** the task called `remember` and `recall` through the managed
  stdio gateway. The provider returned the amber telescope fact from dedicated
  dataset `paperclip_memory_task_e2e_20260924` on the first recall.
- **MEM-3 / Supermemory:** read-only search succeeded within the consented tag
  with an honest zero-result response; one out-of-scope search returned the
  provider's explicit 403 denial. This does not test memory writes under
  read-only consent. The task exposed a gateway reporting defect: provider
  `isError: true` was recorded and returned as success. Failed provider calls now
  produce failed invocation/audit records and an MCP `isError: true` response.
  A second browser-triggered agent run confirmed both the successful scoped
  search and the corrected error response; audit records show `call_failed`,
  `outcome: failure`, and `reasonCode: tool_error` for the denied search.
- **MEM-4 / Zep** and **MEM-5 / Honcho:** readiness tasks retain the account
  prerequisites above. They do not count as successful authenticated provider
  E2E tests.

All tools default to **Allowed**, including writes and destructive actions.
The temporary Mem0 **Ask first** test override was removed after the approval
test. Effective agent access was checked again: Mem0 11/11, Cognee 3/3, and
Supermemory 16/16 allowed, with zero ask-first or off actions. Provider OAuth
consent remains a separate boundary from Paperclip tool permissions.

### Daytona sandbox verification (September 24, 2026)

Browser-created **MEM-6** runs the same three connected providers through a
native `paperclip_runner` Codex agent in a real Daytona Linux x86_64 sandbox.
The acceptance task uses only synthetic data and managed tools: a Mem0 copper
lantern fact, a dedicated Cognee dataset, and Supermemory searches inside and
outside the existing read-only consent. Zep and Honcho retain the account
prerequisites above. This is a manual Product E2E attempt, not a full eval campaign.

The immutable sandbox image is
`ghcr.io/paperclipai/paperclip-daytona-runner@sha256:b782947dc9738038570308686858dfb37fd731aba2f82944b6bb665a419e2f24`.
The remote runner binary was extracted from that image (SHA-256
`5067194e4a4eff0946e312b162e78a46184dae49c29f5699be81fec6cfd0b9d7`).
The first attempt failed before provider startup because a macOS host needs
`PAPERCLIP_RUNNER_REMOTE_BINARY_PATH` pointing to a Linux binary. After configuring
it, PRP authenticated through Daytona provider ingress and the agent executed in
`/home/daytona/paperclip-workspace` as the `daytona` user.

That retry did **not** pass connector acceptance: its assigned MCP URL pointed to
the local host's loopback address, which means the sandbox itself when used
remotely. No memory provider calls ran. Catalog readiness from
`connections_search` does not prove remote gateway connectivity. Native assigned
MCP traffic uses a direct HTTP connection, separate from the PRP control channel;
the remote Codex path now relays assigned tools through the existing authenticated
PRP dynamic-tool channel. The control plane retains the short-lived gateway token
and invokes the same gateway service for discovery and each call. Provider
credentials, policies, approval checks, and audit records stay server-owned.
Every call also verifies the native run still owns its task; planning/ask modes
expose only read tools. Other provider/local paths retain their existing HTTP MCP
delivery. No tunnel or public board/API exposure is needed for remote Codex.
Provider threads retain dynamic-tool declarations, so the remote session contract
also rotates when introducing the relay. An intermediate retry discovered all
30 tools server-side but resumed an old provider catalog; it made no provider
calls and is not counted as a pass.

The final browser-triggered run `16c288bc-27c3-4010-b8f8-e3d24d007c59` completed
**MEM-6** successfully in 1m 36s with the default configured `gpt-5.6-sol` model.
Task-scoped gateway audit records independently confirm six calls:

- Mem0 `add_memory` stored the exact copper lantern fact with `infer=false`;
  `search_memories` returned the same ID (`ba30eea2-f68b-4873-acbe-a59dae98ed75`)
  under user `paperclip-memory-daytona-e2e-20260924`.
- Cognee `remember` accepted the dedicated
  `paperclip_memory_daytona_e2e_20260924` dataset, and `recall` returned the fact
  on the first attempt. Its stdio provider process remains on the control plane;
  the Daytona agent calls it through PRP.
- Supermemory `search_memory` succeeded within the existing consented tag with
  zero results. Exactly one unconsented search returned the expected 403 scope
  restriction and was audited as `call_failed` / `tool_error`.

No approval prompts, public tunnel, direct provider API fallback, or provider
credentials in the agent environment were used. All assigned tools remain
Allowed. This proves the connected Mem0, Cognee, and Supermemory journeys on
remote native Codex; it does not establish live Zep/Honcho access or Supermemory
writes beyond its existing read-only consent. Failed setup attempts are retained
in the task history. The disposable environment is removed after verification.

### Storybook walkthrough checks

The Memory group includes 21 stories covering the catalog, experimental switch,
all five setup flows, credential forms, OAuth waiting/failure, completion, and
narrow layouts. Zep and Supermemory now fetch identity fixtures after mount;
preseeded query-cache data previously left their “Which humans” step waiting
forever. Browser walkthroughs reach both providers' ready screens with all tools
allowed. Credential play functions wait for the access button to become enabled;
browser checks also confirmed rejected Mem0 credentials and narrow Cognee inputs.
These are simulated provider journeys and do not replace live account tests.

### Automated checks

- `pnpm -r typecheck` and `pnpm build` passed. The final server changes also
  passed `tsc --noEmit`.
- Connector service, memory governance, and instance-setting regressions: 399
  tests passed with embedded PostgreSQL enabled.
- Focused shared/UI contract and setup tests: 281 passed.
- Storybook production build, token gates, brand asset validation, and
  `git diff --check` passed. Browser review covered both themes, the 320px
  Storybook viewport, disabled setup, the toggle, OAuth waiting, and rejected-key
  retry. Storybook authentication remains simulated.
- The full repository suite finished: 686 files passed, six failed, four skipped;
  13,308 tests passed, 11 failed, 84 skipped. It reported failures in Slack
  callback batching, concurrent workspace port allocation, and deferred heartbeat
  comment batching. Initial connector count/error and instance-setting snapshot
  failures were corrected and their full targeted suites passed. That run also
  loaded memory-normalization code before the final implementation was saved;
  the final targeted memory suite passed. The full suite is not claimed green.
- Codex managed-home regression suite: 53 passed after the live-task fix;
  adapter typecheck and build passed.
- Gateway acceptance/service regression suites: 103 passed after the provider
  error-reporting fix; server typecheck passed.
- Native relay/session/authority regressions: 534 passed, followed by 36 final
  relay/authority checks covering readable tool names and live task-mode changes.
  Final server typecheck and build passed. Relay checks cover configured gateway
  reuse, gateway errors, revocation, partial bindings, credential isolation, and
  planning/ask restrictions.

## Branding provenance

Official artwork downloaded September 24, 2026; no invented marks or colors:

- Zep: `https://www.getzep.com/apple-touch-icon.png` (official gradient mark).
- Supermemory: `https://supermemory.ai/apple-touch-icon.png?v=2` (official mark on
  its supplied white background).
- Cognee: `https://www.cognee.ai/favicon.ico`, converted losslessly to PNG.
- Honcho: `https://honcho.dev/Honcho_Pixel-05.svg`.
- Mem0 reuses the existing catalog artwork.

The supplied square artwork fits the shared gray connector frame and works in
both themes. Registry changes are in `ui/public/brands/apps/manifest.json`;
regenerate definitions with `node scripts/ingest-app-definitions.mjs --definitions-only`.
