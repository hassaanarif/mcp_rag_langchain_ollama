import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// LangChain Core
import { ChatOllama } from "@langchain/ollama";
import { OllamaEmbeddings } from "@langchain/ollama";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// PDF Loader
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

let vectorStore;
let llm;

// =======================
// INIT RAG ONCE
// =======================
async function initRag() {
  console.log("🚀 Initializing RAG service...");

  const pdfPath = path.join(__dirname, "assets", "transport_policy.pdf");
  const loader = new PDFLoader(pdfPath);

  const docs = await loader.load();
  console.log(`📄 PDF Loaded: ${docs.length} pages`);

  // STEP 1 — Chunk docs
  console.log("🔪 Splitting documents for RAG...");
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 200,
  });
  const chunks = await splitter.splitDocuments(docs);
  console.log(`📦 Chunked into ${chunks.length} segments`);

  // STEP 2 — Create embeddings ONCE
  console.log("🧠 Creating embeddings...");
  const embeddings = new OllamaEmbeddings({
    model: "nomic-embed-text",
  });

  vectorStore = await MemoryVectorStore.fromDocuments(chunks, embeddings);
  console.log("💾 Embeddings stored in memory!");

  // STEP 3 — DROP EMBEDDING MODEL
  console.log("🛑 Embedding model no longer needed");

  // STEP 4 — Load Chat model
  llm = new ChatOllama({
    model: "qwen2.5:1.5b",
    temperature: 0.3,
  });

  console.log("🤖 Qwen model ready");
}

await initRag();

// =======================
// REST API
// =======================

app.post("/query", async (req, res) => {
  try {
    console.log("Request body:", req.body);
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Missing query" });
    }

    console.log(`🧠 User query: ${query}`);

    // Retrieval from vector store
    const results = await vectorStore.similaritySearch(query, 5);

    const context = results.map((r) => r.pageContent).join("\n---\n");

    const prompt = `
You are an expert Transport Policy assistant.
Answer ONLY using the provided CONTEXT.
If the answer is not present, respond "I don't know."

CONTEXT:
${context}

QUERY:
${query}
`;

    const response = await llm.invoke(prompt);

    console.log("Response content:", response.content);

    // Normalize the LLM response to a simple string answer
    let answerText;
    if (Array.isArray(response.content)) {
      answerText = response.content
        .map((part) => (typeof part === "string" ? part : part.text ?? ""))
        .join("\n");
    } else {
      answerText = String(response.content ?? "");
    }

    res.json({
      answer: answerText,
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// Server Start
// =======================

app.listen(3001, () => {
  console.log("📡 RAG listening at http://localhost:3001");
});
