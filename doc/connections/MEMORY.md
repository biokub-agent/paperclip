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
  tag and one inert test agent. Search succeeded; a query for an unconsented tag
  returned the expected provider denial. Live discovery returned 16 tools.
- Cognee: API key created and Cloud access verified. The official pinned MCP
  client stored synthetic notebook text in a dedicated test dataset and recalled
  it after indexing completed. Personal setup exposes the three reviewed tools.
  Paperclip gateway recall returned the expected blue notebook fact (10.6s).
  A nonexistent test dataset returned a tool error, correctly recorded as failure.
- Zep: Google sign-in reached “Account not found”; account creation is pending.
- Honcho: Google sign-in succeeded, but organization onboarding twice returned
  “Could not create your organization. Please try again.” No key could be created.

Zep and Honcho remain unverified against authenticated provider accounts. Public
protocol discovery and deterministic fixtures do not replace that live proof.
No real memories were uploaded for testing. The synthetic Cognee dataset is
`paperclip_memory_connector_smoke_20260924`; the Mem0 test user and Supermemory
consent tag are `paperclip-memory-smoke-20260924`.

### Local checks

- `pnpm -r typecheck` and `pnpm build` passed. The final server changes also
  passed `tsc --noEmit`.
- Connector service, memory governance, and instance-setting regressions: 399
  tests passed with embedded PostgreSQL enabled.
- Focused shared/UI contract and setup tests: 281 passed.
- Storybook production build, token gates, brand asset validation, and
  `git diff --check` passed. Browser review covered both themes, the 320px
  Storybook viewport, disabled setup, the toggle, OAuth waiting, and rejected-key
  retry. Storybook authentication remains simulated.
- The full repository suite was also started. It reported failures in Slack
  callback batching, concurrent workspace port allocation, and deferred heartbeat
  comment batching. Initial connector count/error and instance-setting snapshot
  failures were corrected and their full targeted suites passed. The full suite
  is not claimed green.

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
