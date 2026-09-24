import { describe, expect, it } from "vitest";
import { classifyRisk } from "../services/tool-access.js";
import { COGNEE_STDIO_TEMPLATE, cogneeCloudUrl, normalizeCogneeResult } from "../services/cognee-connection.js";

describe("memory tool governance", () => {
  it.each([
    ["mem0", "add_memory", "write"], ["mem0", "search_memories", "read"],
    ["mem0", "delete_entities", "destructive"], ["zep", "add_memory_to_graph", "write"],
    ["supermemory", "add_memory", "destructive"], ["supermemory", "select-space", "write"],
    ["supermemory", "get_profile", "read"], ["cognee", "remember", "write"],
    ["cognee", "recall", "read"], ["cognee", "forget", "destructive"],
    ["honcho", "create_peer", "write"], ["honcho", "future_unknown_action", "write"],
  ])("classifies %s %s even with a misleading read hint", (provider, name, expected) => {
    expect(classifyRisk({ name, annotations: { readOnlyHint: true } }, provider)).toBe(expected);
  });
  it("pins the approved Cognee command and limits projected environment", () => {
    expect(COGNEE_STDIO_TEMPLATE.args).toEqual(["--from", "cognee-mcp==0.5.5", "cognee-mcp"]);
    expect(COGNEE_STDIO_TEMPLATE.envKeys).toEqual(["COGNEE_BASE_URL", "COGNEE_API_KEY"]);
    expect(COGNEE_STDIO_TEMPLATE.tools.map(t => t.name)).toEqual(["remember", "recall", "forget"]);
  });
  it.each(["http://localhost", "https://evil.test", "https://tenant.aws.cognee.ai@evil.test", "https://tenant.aws.cognee.ai/other", "https://tenant.aws.cognee.ai?key=secret", "https://tenant.aws.cognee.ai:8443"])("rejects unreviewed Cognee URL %s", (url) => {
    expect(() => cogneeCloudUrl(url)).toThrow();
  });
  it("accepts the tenant API origin", () => expect(cogneeCloudUrl("https://tenant.aws.cognee.ai").origin).toBe("https://tenant.aws.cognee.ai"));
  it.each(["Remember failed: denied", "Recall failed: no dataset", "Forget failed: denied", "Specify 'dataset' name or set 'everything' to true."])("surfaces Cognee text-only failures: %s", (message) => {
    expect(normalizeCogneeResult({ content: [{ type: "text", text: `Error: ${message}` }], isError: false })).toMatchObject({ isError: true });
  });
  it("preserves successful Cognee results", () => {
    const result = { content: [{ type: "text", text: "Stored permanently in knowledge graph." }] };
    expect(normalizeCogneeResult(result)).toBe(result);
  });
});
