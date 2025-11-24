# RAG + MCP (Ollama) — Transport Policy Example

This project demonstrates how to connect a **local RAG (Retrieval-Augmented Generation) service** running on top of **Ollama** to an **MCP server** that exposes a `getTransportPolicy` tool to clients such as **Claude Desktop**.

The example uses a local **PDF transport policy document** and lets you ask natural language questions about it via MCP.

---

## High-Level Architecture

- **RAG Service (`rag-service/`)**

  - Node.js + Express HTTP API.
  - Uses LangChain + Ollama for:
    - PDF loading and chunking.
    - Embeddings via `nomic-embed-text` and in-memory vector store.
    - Question-answering via `qwen2.5:1.5b` chat model.
  - Exposes a `POST /query` endpoint on **http://localhost:3001/query** that returns an answer string.

- **MCP Server (`mcp-server/`)**

  - Implements an MCP server using `@modelcontextprotocol/sdk`.
  - Registers a single tool: **`getTransportPolicy`**.
  - When invoked, it calls the RAG service’s `/query` endpoint and returns:
    - Human-readable `content` for display in the client.
    - `structuredContent` matching the tool’s output schema (`{ answer: string }`).

- **MCP Client (e.g. Claude Desktop)**
  - Connects to the MCP server over stdio.
  - Exposes the `getTransportPolicy` tool in the UI so you can query the local transport policy.

---

## Tools Exposed by the MCP Server

- **`getTransportPolicy`**
  - **Description:** Query the local RAG system for transport policy answers.
  - **Input schema:**
    - `query` (string) — The transport policy question to answer.
  - **Output schema (structuredContent):**
    - `answer` (string) — The answer to the transport policy question.
  - **Behavior:**
    - Sends the `query` to the RAG HTTP service at `http://localhost:3001/query`.
    - The RAG service retrieves relevant chunks from the PDF and calls the LLM.
    - Returns the answer both as normal MCP `content` (for display) and as `structuredContent.answer` (for programmatic use).

---

## Prerequisites

- **General**

  - Node.js **18+** and npm
  - Git (optional, for cloning from GitHub)

- **Ollama**

  - Install Ollama: https://ollama.com
  - Ensure the Ollama daemon is running (`ollama serve` usually runs automatically when you use `ollama` commands).

- **Models / Embeddings required by this project**

```bash
ollama pull qwen2.5:1.5b
ollama pull nomic-embed-text
```

These models are used by the RAG service:

- `nomic-embed-text` — for generating embeddings and building the in-memory vector store.
- `qwen2.5:1.5b` — as the chat model for answering transport policy questions.

---

## Project Layout

- **`rag-service/`**  
  Node.js + Express REST API exposing `/query` for RAG queries.

- **`mcp-server/`**  
  MCP server implementation exposing the `getTransportPolicy` tool over stdio.

- **`assets/transport_policy.pdf`** (inside `rag-service/`)  
  Source PDF used as the knowledge base for the RAG pipeline.

---

## Setup and Installation

Clone the repository (if you haven’t already):

```bash
git clone <your-repo-url> rag-mcp-ollama
cd rag-mcp-ollama
```

You will set up **both** the RAG service and the MCP server.

### 1. Install dependencies for the RAG service

From the project root:

```bash
cd rag-service
npm install
```

This installs LangChain, Express, and related dependencies.

### 2. Install dependencies for the MCP server

From the project root:

```bash
cd mcp-server
npm install
```

This installs the Model Context Protocol SDK and TypeScript.

### 3. Build the MCP server

From `mcp-server/`:

```bash
npm run build
```

This compiles the TypeScript source in `src/` to JavaScript in `build/` and makes `build/index.js` executable.

> Note: The MCP server binary is configured in `package.json` under `bin`, but you can also run it directly with Node (see below).

---

## Running the System Locally

You need to run **two processes**:

1. **RAG HTTP service** (Express app).
2. **MCP server** (stdio-based process used by the MCP client).

### Step 1 — Start Ollama (if not already running)

On most systems, Ollama will start automatically when a model is used. To be explicit, you can run:

```bash
ollama serve
```

Ensure the required models are pulled:

```bash
ollama pull qwen2.5:1.5b
ollama pull nomic-embed-text
```

### Step 2 — Start the RAG service

In a terminal:

```bash
cd rag-mcp-ollama/rag-service
npm start
```

What this does:

- Loads `assets/transport_policy.pdf`.
- Splits it into chunks using `RecursiveCharacterTextSplitter`.
- Builds an in-memory `MemoryVectorStore` with `nomic-embed-text` embeddings.
- Initializes the `qwen2.5:1.5b` chat model.
- Starts an Express server on **http://localhost:3001** with:
  - `POST /query` — expects JSON `{ "query": "your question" }` and responds with `{ "answer": "..." }`.

You can test it directly:

```bash
curl -X POST http://localhost:3001/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the transport policy about?"}'
```

### Step 3 — Run the MCP server

In a separate terminal:

```bash
cd rag-mcp-ollama/mcp-server
npm run build   # if not already built
node build/index.js
```

This starts the MCP server on stdio. It logs to stderr:

- `Transport MCP Server running on stdio`

The MCP server exposes the `getTransportPolicy` tool and forwards queries to the RAG service running on port 3001.

---

## Using with Claude Desktop (or another MCP client)

> The exact configuration format may differ per client. Below is a **conceptual example** for wiring this MCP server into a typical MCP-enabled client.

Configure a new MCP server entry pointing to the Node command that runs your MCP server, for example:

```jsonc
{
  "transport-mcp": {
    "command": "node",
    "args": ["/absolute/path/to/rag-mcp-ollama/mcp-server/build/index.js"],
    "env": {
      // Add any environment overrides if needed
    }
  }
}
```

Once configured and enabled in your MCP client:

- You should see a **`transport-mcp`** (or similar) server available.
- It will expose the **`getTransportPolicy`** tool.
- You can type questions such as:
  - "What is the maximum allowed speed in the transport policy?"
  - "How are safety inspections described in the policy?"

The client will call the `getTransportPolicy` tool, which calls the RAG service and returns an answer based on the PDF.

---

## Development Notes

- **RAG service (`rag-service/index.js`)**

  - Uses `PDFLoader` to load `assets/transport_policy.pdf`.
  - Splits documents with `RecursiveCharacterTextSplitter`.
  - Builds a `MemoryVectorStore` with `OllamaEmbeddings` (`nomic-embed-text`).
  - Uses `ChatOllama` (`qwen2.5:1.5b`) to answer questions given retrieved context.

- **MCP server (`mcp-server/src/index.ts`)**
  - Uses `@modelcontextprotocol/sdk` to create an `McpServer`.
  - Registers `getTransportPolicy` with:
    - `inputSchema`: `{ query: string }`.
    - `outputSchema`: `{ answer: string }`.
  - Calls the RAG service at `http://localhost:3001/query` and maps the response to both `content` and `structuredContent`.

---

## Troubleshooting

- **RAG service not responding / connection refused**

  - Ensure `npm start` is running in `rag-service/` and listening on port 3001.
  - Check that Ollama is running and models are pulled.

- **MCP client reports output schema / validation errors**

  - Confirm you are using the built server (`node build/index.js`).
  - Ensure both `content` and `structuredContent.answer` are being returned (already implemented in this repo).

- **Ollama model errors or slow responses**
  - Verify `ollama serve` is running and system resources are sufficient.
  - Make sure the correct models are pulled: `qwen2.5:1.5b` and `nomic-embed-text`.

---

## License

This project is provided as an example for building RAG + MCP integrations with Ollama. Adjust the license text as needed for your use case.
