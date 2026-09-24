/** Reviewed contract from cognee-mcp 0.5.5 (PyPI). Only these tools are exposed. */
export const COGNEE_STDIO_TEMPLATE = {
  name: "Cognee Cloud",
  command: "uvx",
  args: ["--from", "cognee-mcp==0.5.5", "cognee-mcp"],
  envKeys: ["COGNEE_BASE_URL", "COGNEE_API_KEY"],
  tools: [
    {
      name: "remember", description: "Store text in a Cognee dataset or session.",
      annotations: { readOnlyHint: false },
      inputSchema: { type: "object", properties: {
        data: { type: "string" }, dataset_name: { type: "string" },
        session_id: { type: "string" }, custom_prompt: { type: "string" },
      }, required: ["data"], additionalProperties: false },
    },
    {
      name: "recall", description: "Search Cognee memory, optionally within named datasets or a session.",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {
        query: { type: "string" }, search_type: { type: "string" }, datasets: { type: "string" },
        session_id: { type: "string" }, system_prompt: { type: "string" }, top_k: { type: "integer", minimum: 1, default: 15 },
      }, required: ["query"], additionalProperties: false },
    },
    {
      name: "forget", description: "Permanently delete a Cognee dataset, or all owned memory when everything is true.",
      annotations: { destructiveHint: true },
      inputSchema: { type: "object", properties: {
        dataset: { type: "string" }, everything: { type: "boolean", default: false },
      }, additionalProperties: false },
    },
  ],
};

export function cogneeCloudUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.aws\.cognee\.ai$/i.test(url.hostname)
    || url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Copy the tenant API Base URL from Cognee's API Keys page.");
  }
  return url;
}

/** 0.5.5 reports tool failures as text instead of setting MCP isError. */
export function normalizeCogneeResult(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const record = result as Record<string, unknown>;
  const failed = Array.isArray(record.content) && record.content.some((item) =>
    item && typeof item === "object" && item.type === "text" && typeof item.text === "string"
    && /^Error: (?:Remember failed:|Recall failed:|Forget failed:|Specify 'dataset')/.test(item.text),
  );
  return failed ? { ...record, isError: true } : result;
}
