import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create server instance
const server = new McpServer({
  name: "transport-mcp",
  version: "1.0.0",
});

server.registerTool(
  "getTransportPolicy",
  {
    description: "Query the local RAG system for transport policy answers",
    inputSchema: z.object({
      query: z.string().describe("The transport policy question to answer"),
    }),
    outputSchema: z.object({
      answer: z
        .string()
        .describe("The answer to the transport policy question"),
    }),
  },
  async ({ query }) => {
    const resp = await fetch("http://localhost:3001/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`RAG service error: ${resp.status} ${t}`);
    }

    const data = await resp.json();

    console.error("RAG Response: ", data);

    const answerText =
      typeof data.answer === "string"
        ? data.answer
        : JSON.stringify(data.answer);

    // Return both display content and structuredContent matching outputSchema
    return {
      content: [
        {
          type: "text",
          text: answerText,
        },
      ],
      structuredContent: {
        answer: answerText,
      },
    };
  }
);

// Running the Server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Transport MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
