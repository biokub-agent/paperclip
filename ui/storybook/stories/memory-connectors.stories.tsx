import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getConnectableAppDefinition, MEMORY_CONNECTOR_IDS, INSTANCE_FEATURE_KEYS, instanceExperimentalSettingsSchema, type MemoryConnectorId } from "@paperclipai/shared";
import { queryKeys } from "@/lib/queryKeys";
import { ConnectionSetupFlow, OAuthConnectStateScreen } from "@/features/connections/ConnectionSetupFlow";
import { ConnectorCard } from "@/pages/apps/Browse";
import { InstanceExperimentalSettings } from "@/pages/InstanceExperimentalSettings";
import { Button } from "@/components/ui/button";

const COMPANY = "company-storybook";
const apps = MEMORY_CONNECTOR_IDS.map(slug => getConnectableAppDefinition(slug)!);

type Scenario = "catalog" | "setup" | "disabled" | "settings" | "rejected" | "waiting";
function MemoryReview({ provider = "mem0", scenario = "catalog" }: { provider?: MemoryConnectorId; scenario?: Scenario }) {
  const [selection, setSelection] = useState<MemoryConnectorId | null>(scenario === "catalog" || scenario === "settings" ? null : provider);
  const [completed, setCompleted] = useState(false);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState(scenario === "rejected");
  const client = useMemo(() => {
    const q = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnMount: false } } });
    q.setQueryData(queryKeys.instance.experimentalSettings, { ...instanceExperimentalSettingsSchema.parse({}), enableMemoryConnectors: scenario !== "disabled" });
    q.setQueryData(queryKeys.apps.gallery(COMPANY), { apps, capabilities: { canSetCompanyInstall: true, companyInstallReason: null } });
    q.setQueryData(queryKeys.tools.applications(COMPANY), { applications: [] });
    q.setQueryData(queryKeys.tools.connections(COMPANY), { connections: [] });
    q.setQueryData(queryKeys.health, { status: "ok", deploymentMode: "local_trusted", hiddenSettings: INSTANCE_FEATURE_KEYS.filter(k => k !== "enableMemoryConnectors").map(k => `instance.experimental.${k}`) });
    return q;
  }, [scenario]);

  useEffect(() => {
    const original = window.fetch;
    const fixture: typeof window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.origin);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (url.pathname === "/api/instance/settings/experimental" && method === "PATCH") {
        const settings = { ...client.getQueryData<object>(queryKeys.instance.experimentalSettings), ...JSON.parse(String(init?.body ?? "{}")) };
        client.setQueryData(queryKeys.instance.experimentalSettings, settings);
        return Response.json(settings);
      }
      if (url.pathname === `/api/companies/${COMPANY}/tools/apps/connect`) {
        if (failure) return Response.json({ error: "The provider rejected this connection. Check your credentials or account access, then try again." }, { status: 422 });
        const body = JSON.parse(String(init?.body ?? "{}"));
        const app = getConnectableAppDefinition(body.galleryKey)!;
        // Authentication and discovery are simulated as already completed. No OAuth window or provider request is opened.
        return Response.json({ connectionId: "memory-review", application: { id: "memory-review-app", name: app.name },
          connection: { id: "memory-review", name: app.name, config: { sourceTemplateKey: app.slug }, status: "active" },
          catalog: [], actions: { readOnly: [{ catalogEntryId: "recall", toolName: "recall", riskLevel: "read" }], canMakeChanges: [{ catalogEntryId: "remember", toolName: "remember", riskLevel: "write" }] }, suggestedDefaults: {}, auth: null });
      }
      if (url.pathname === `/api/companies/${COMPANY}/tools/apps/memory-review/finish` || url.pathname.startsWith("/api/tool-connections/memory-review/")) return Response.json({ connectionId: "memory-review", installs: [] });
      if (url.pathname.startsWith(`/api/companies/${COMPANY}/tools/apps/`)) return Response.json({ oauth: { metadataFound: true, registrationAdvertised: true }, endpointReachable: true });
      return original(input, init);
    };
    window.fetch = fixture;
    setReady(true);
    return () => { if (window.fetch === fixture) window.fetch = original; };
  }, [client, failure]);
  const app = selection ? getConnectableAppDefinition(selection)! : null;
  return <QueryClientProvider client={client}>
    <div className="min-h-screen bg-background text-foreground">
      <p role="note" className="border-b border-border bg-muted p-4 text-sm">Storybook simulation · Production catalog, setup, and experimental controls. Use fake credentials. Sign-in and tool discovery are simulated; no provider calls or secret storage.</p>
      {scenario === "settings" ? <InstanceExperimentalSettings /> : <div className="mx-auto max-w-4xl space-y-4 p-6">
        {completed ? <div role="status" className="space-y-4"><h2 className="text-lg font-semibold">{app?.name} connected</h2><p className="text-sm text-muted-foreground">Simulated setup complete. In Paperclip, this opens the connection’s regular Permissions screen; agents use its tools from their tasks.</p><Button onClick={() => { setCompleted(false); setSelection(null); }}>Back to connectors</Button></div>
          : scenario === "waiting" && app ? <OAuthConnectStateScreen entry={app} resuming={false} phase="redirecting" error={null} onRetry={() => {}} onBack={() => setSelection(null)} onCancel={() => setSelection(null)} />
          : selection && ready ? <ConnectionSetupFlow key={selection} serviceSlug={selection} onComplete={() => setCompleted(true)} onCancel={() => setSelection(null)} />
          : <div role="list" className="space-y-3">{apps.map(entry => <ConnectorCard key={entry.slug} row={{ key: entry.slug, slug: entry.slug, name: entry.name, description: entry.description, brandKey: entry.slug, logoUrl: entry.branding.logoUrl, darkLogoUrl: entry.branding.darkLogoUrl, entry, applications: [], connections: [], chatEndpoints: [] }} userProfileById={new Map()} chatConnectorsEnabled={false} onNavigate={() => setSelection(entry.slug as MemoryConnectorId)} onRequestRemove={() => {}} />)}</div>}
        {selection && !completed && scenario !== "disabled" && <div className="flex items-center gap-3 border-t border-border pt-4"><Button size="sm" variant="ghost" onClick={() => setSelection(null)}>Catalog</Button><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={failure} onChange={event => setFailure(event.target.checked)} />Simulate rejected credentials</label></div>}
      </div>}
    </div>
  </QueryClientProvider>;
}
const meta = { title: "Apps/Connections/Memory", component: MemoryReview, parameters: { layout: "fullscreen" } } satisfies Meta<typeof MemoryReview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CatalogAndSetup: Story = { args: { scenario: "catalog" } };
export const ExperimentalToggle: Story = { args: { scenario: "settings" } };
export const DisabledSetup: Story = { args: { scenario: "disabled" } };
export const Mem0: Story = { args: { scenario: "setup", provider: "mem0" } };
export const Zep: Story = { args: { scenario: "setup", provider: "zep" } };
export const Supermemory: Story = { args: { scenario: "setup", provider: "supermemory" } };
export const Cognee: Story = { args: { scenario: "setup", provider: "cognee" } };
export const Honcho: Story = { args: { scenario: "setup", provider: "honcho" } };
export const RejectedCredentials: Story = { args: { scenario: "rejected" } };
export const WaitingForSignIn: Story = { args: { scenario: "waiting", provider: "zep" } };
export const NarrowSetup: Story = { args: { scenario: "setup", provider: "cognee" }, globals: { viewport: { value: "mobile1", isRotated: false } } };
