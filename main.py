import os
import re
import json
import time
import numpy as np
import pandas as pd
import chromadb
from collections import Counter
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from groq import Groq

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────
GROQ_API_KEY    = os.environ.get("GROQ_API_KEY", "")
RAG_CSV_PATH    = os.environ.get("RAG_CSV_PATH",    "results/rag_documents.csv")
EMBEDDINGS_PATH = os.environ.get("EMBEDDINGS_PATH", "results/embeddings.npy")
CHROMA_DIR      = os.environ.get("CHROMA_DIR",      "./chroma_db")
COLLECTION_NAME = "anomaly_logs"

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────
EVENT_DESCRIPTIONS = {
    "E1":  "A DataNode received a request to store a block that already exists — duplicate write or stale reference.",
    "E2":  "Block checksum verification passed — data written is confirmed intact.",
    "E3":  "A DataNode successfully served a block read request.",
    "E4":  "An exception occurred while serving a block — read or transfer failed.",
    "E5":  "A DataNode started receiving a new block — start of a pipeline write.",
    "E6":  "A DataNode finished receiving a full block — complete transfer confirmed.",
    "E7":  "An exception was thrown during a block write operation.",
    "E8":  "The PacketResponder thread was interrupted — unexpected pipeline disruption.",
    "E9":  "A DataNode finished receiving a block of a known size — successful replica receipt.",
    "E10": "The PacketResponder thread threw an unhandled exception.",
    "E11": "The PacketResponder thread for a block terminated — normal end or failure.",
    "E12": "Exception while writing block to a mirror DataNode — replication pipeline failed.",
    "E13": "DataNode received an empty packet — heartbeat or end-of-stream signal.",
    "E14": "Exception inside receiveBlock handler — block write could not complete.",
    "E15": "NameNode adjusted block offset metadata — recovery or corruption repair.",
    "E16": "Block successfully transferred to another DataNode.",
    "E17": "Block transfer to target DataNode failed — re-replication unsuccessful.",
    "E18": "NameNode instructed DataNode to start background block copy thread.",
    "E19": "Block file reopened for appending.",
    "E20": "Delete failed — block metadata not found in DataNode volume map (orphaned block).",
    "E21": "DataNode deleted a block file from local disk — triggered by NameNode invalidation.",
    "E22": "NameNode allocated a new block ID — start of new block creation.",
    "E23": "NameNode added block to invalidation set — scheduled for deletion.",
    "E24": "NameNode removed block from replication queue — no longer belongs to any file.",
    "E25": "NameNode instructed DataNode to replicate block — under-replication detected.",
    "E26": "NameNode updated block map after DataNode reported successful storage.",
    "E27": "Redundant block storage report received — duplicate reporting.",
    "E28": "Block report for unknown file received — block is orphaned.",
    "E29": "Replication request timed out — target DataNode did not complete copy in time.",
}

VALID_ANOMALY_TYPES = {"duplicate_pattern", "repetition", "missing_events", "high_latency"}

FALLBACK_MITIGATIONS = {
    "duplicate_pattern": {
        "high":   ["Check DataNode pipeline threads for race conditions causing duplicate block writes.",
                   "Enable idempotency checks on NameNode to reject duplicate block registrations."],
        "medium": ["Review client retry config — reduce max retries or add backoff jitter.",
                   "Monitor DataNode network throughput for intermittent failures."],
        "low":    ["Audit HDFS client version for known duplicate-write bugs."],
    },
    "repetition": {
        "high":   ["Inspect DataNode for stuck PacketResponder thread and restart if confirmed.",
                   "Check for network packet loss between pipeline DataNodes."],
        "medium": ["Review NameNode RPC logs for timeout patterns triggering re-sends.",
                   "Verify DataNode JVM heap — GC pauses can stall pipeline and trigger retries."],
        "low":    ["Increase pipeline write timeout thresholds to reduce false retry triggers."],
    },
    "missing_events": {
        "high":   ["Inspect DataNode that aborted pipeline — check for disk errors or OOM.",
                   "Verify block replication in NameNode — trigger re-replication if under-replicated."],
        "medium": ["Review DataNode stderr logs around block timestamp for crash evidence.",
                   "Check network stability between pipeline nodes for partial disconnects."],
        "low":    ["Add HDFS block scanner runs to detect and repair corrupted replicas."],
    },
    "high_latency": {
        "high":   ["Profile DataNode disk I/O at write time — check for saturation or slow disks.",
                   "Check network bandwidth between NameNode and DataNodes during latency window."],
        "medium": ["Review JVM GC logs on affected DataNode for stop-the-world pauses.",
                   "Verify DataNode CPU is not contended by co-located processes."],
        "low":    ["Move high-throughput workloads to dedicated DataNodes to reduce latency variance."],
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# GLOBALS
# ─────────────────────────────────────────────────────────────────────────────
documents:        list        = []
all_metadata:     list        = []
block_lookup:     dict        = {}
collection                    = None
groq_client                   = None
embeddings_matrix: Optional[np.ndarray] = None


# ─────────────────────────────────────────────────────────────────────────────
# STARTUP — lightweight, no model downloads
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global documents, all_metadata, block_lookup, collection, groq_client, embeddings_matrix

    print("[startup] Loading RAG documents...")
    rag_df    = pd.read_csv(RAG_CSV_PATH)
    documents = rag_df["RAG_Document"].tolist()
    print(f"[startup] {len(documents)} documents loaded.")

    all_metadata = [parse_metadata_from_doc(doc) for doc in documents]

    print("[startup] Loading pre-computed embeddings...")
    embeddings_matrix = np.load(EMBEDDINGS_PATH).astype("float32")
    norms = np.linalg.norm(embeddings_matrix, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1e-9, norms)
    embeddings_matrix = embeddings_matrix / norms
    print(f"[startup] Embeddings shape: {embeddings_matrix.shape}")

    print("[startup] Building ChromaDB index (in-memory)...")
    chroma_client = chromadb.EphemeralClient()
    try:
        chroma_client.delete_collection(name=COLLECTION_NAME)
    except Exception:
        pass
    collection = chroma_client.create_collection(name=COLLECTION_NAME)

    BATCH = 500
    for start in range(0, len(documents), BATCH):
        end = min(start + BATCH, len(documents))
        collection.add(
            documents  = documents[start:end],
            embeddings = embeddings_matrix[start:end].tolist(),
            ids        = [str(i) for i in range(start, end)],
            metadatas  = all_metadata[start:end],
        )
    print(f"[startup] Indexed {collection.count()} vectors.")

    block_lookup = {
        m["block_id"]: (documents[i], m, i)
        for i, m in enumerate(all_metadata)
    }

    groq_client = Groq(api_key=GROQ_API_KEY)
    print("[startup] Ready.")
    yield
    print("[shutdown] Done.")


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def parse_metadata_from_doc(doc: str) -> dict:
    block_id_m = re.search(r"Block ID\s*:\s*(\S+)", doc)
    atypes_m   = re.search(r"Anomaly Type\(s\)\s*:\s*(.+)", doc)
    latency_m  = re.search(r"Latency\s*:\s*(\d+)", doc)
    total_m    = re.search(r"Total Events\s*:\s*(\d+)", doc)
    full_types   = atypes_m.group(1).strip() if atypes_m else "unknown"
    primary_type = full_types.split(",")[0].strip()
    return {
        "block_id":     block_id_m.group(1).strip() if block_id_m else "unknown",
        "anomaly_types": full_types,
        "primary_type":  primary_type,
        "latency":       int(latency_m.group(1)) if latency_m else 0,
        "total_events":  int(total_m.group(1))   if total_m   else 0,
    }


def build_event_context(doc: str) -> str:
    """Scan the entire document for E-codes — handles multi-line sequences."""
    ids = list(dict.fromkeys(re.findall(r"\bE\d+\b", doc)))
    if not ids:
        return "No events found."
    return "\n".join(f"{e}: {EVENT_DESCRIPTIONS.get(e, 'Unknown event')}" for e in ids)


def compress_historical_case(doc: str, block_id: str, latency: int, distance: float) -> str:
    seq_m   = re.search(r"Event Sequence\s*:\s*(.+)", doc)
    atype_m = re.search(r"Anomaly Type\(s\)\s*:\s*(.+)", doc)
    total_m = re.search(r"Total Events\s*:\s*(\d+)", doc)
    seq     = seq_m.group(1).strip()   if seq_m   else ""
    atype   = atype_m.group(1).strip() if atype_m else "unknown"
    total   = total_m.group(1)         if total_m else "?"
    tokens  = [t.strip() for t in seq.split("->") if t.strip()]
    short   = " -> ".join(tokens[:15])
    if len(tokens) > 15:
        short += f" (+{len(tokens)-15} more)"
    return (f"Block: {block_id} | {atype} | {latency}ms | dist={distance:.3f} | events={total}\n"
            f"Seq: {short}")


def repair_json(s: str) -> dict:
    s = s.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    s = re.sub(r",\s*([}\]])", r"\1", s)
    s = re.sub(r"(?<![\w])'([^']*)'(?![\w])", r'"\1"', s)
    result = []; in_string = False; i = 0
    while i < len(s):
        c = s[i]
        if c == "\\" and in_string:
            result.append(c); i += 1
            if i < len(s): result.append(s[i])
            i += 1; continue
        if c == '"':
            if not in_string:
                in_string = True; result.append(c)
            else:
                rest   = s[i+1:].lstrip()
                closes = (not rest) or rest[0] in (":", ",", "}", "]")
                if closes or i == len(s) - 1:
                    in_string = False; result.append(c)
                else:
                    result.append('\\"')
            i += 1; continue
        result.append(c); i += 1
    s = "".join(result)
    s = re.sub(r",\s*([}\]])", r"\1", s)
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        if in_string: s += '"'
        depth = []
        for ch in s:
            if ch in ("{", "["): depth.append("}" if ch == "{" else "]")
            elif ch in ("}", "]") and depth: depth.pop()
        s += "".join(reversed(depth))
        s = re.sub(r",\s*([}\]])", r"\1", s)
        return json.loads(s)


def compute_confidence(similar_docs: list, query_doc: str, latency: int) -> tuple[float, str]:
    """Compute a deterministic confidence score from retrieval distance, event repetition, and latency."""
    # 1. Retrieval quality
    avg_dist = sum(d["distance"] for d in similar_docs) / max(len(similar_docs), 1)
    retrieval_score = 0.9 if avg_dist < 0.70 else (0.7 if avg_dist < 0.80 else 0.5)

    # 2. Event repetition (how abnormal the sequence is)
    event_ids = re.findall(r"\bE\d+\b", query_doc)
    if event_ids:
        counts = Counter(event_ids)
        repetition_score = sum(v for v in counts.values() if v > 1) / len(event_ids)
    else:
        repetition_score = 0.0

    # 3. Latency severity
    latency_score = 0.9 if latency > 20000 else (0.7 if latency > 8000 else 0.5)

    confidence = round(min(max((retrieval_score + repetition_score + latency_score) / 3, 0.0), 1.0), 2)
    label = "high" if confidence >= 0.75 else ("medium" if confidence >= 0.4 else "low")
    return confidence, label


# ─────────────────────────────────────────────────────────────────────────────
# RETRIEVAL
# ─────────────────────────────────────────────────────────────────────────────
def retrieve_similar(query: str, k: int = 3, anomaly_type_filter: Optional[str] = None) -> list:
    """
    Path 1 — known block_id: use its precomputed embedding vector via ChromaDB cosine search.
    Path 2 — free text: keyword token-overlap scoring (no model needed).
    """
    entry = block_lookup.get(query.strip())
    if entry:
        _, _, idx = entry
        query_vec = embeddings_matrix[idx].tolist()
        where = {"primary_type": {"$eq": anomaly_type_filter}} if anomaly_type_filter else None
        res = collection.query(
            query_embeddings=[query_vec],
            n_results=min(k + 1, collection.count()),
            where=where,
        )
        results = []
        for doc, m, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
            if m.get("block_id") == query.strip():
                continue
            results.append({
                "document":     doc,
                "block_id":     m.get("block_id", "?"),
                "primary_type": m.get("primary_type", "?"),
                "latency":      m.get("latency", 0),
                "distance":     dist,
            })
            if len(results) >= k:
                break
        return results

    # Path 2: keyword overlap
    query_tokens = set(re.findall(r"\b\w+\b", query.lower()))
    candidates = []
    for i, (doc, meta) in enumerate(zip(documents, all_metadata)):
        if anomaly_type_filter and meta["primary_type"] != anomaly_type_filter:
            continue
        doc_tokens = set(re.findall(r"\b\w+\b", doc.lower()))
        score = len(query_tokens & doc_tokens) / max(len(query_tokens), 1)
        candidates.append((score, i))
    candidates.sort(key=lambda x: x[0], reverse=True)
    return [
        {
            "document":     documents[i],
            "block_id":     all_metadata[i].get("block_id", "?"),
            "primary_type": all_metadata[i].get("primary_type", "?"),
            "latency":      all_metadata[i].get("latency", 0),
            "distance":     round(1.0 - score, 4),
        }
        for score, i in candidates[:k]
    ]


# ─────────────────────────────────────────────────────────────────────────────
# LLM
# ─────────────────────────────────────────────────────────────────────────────
def build_llm_prompt(query_doc: str, hist_ctx: str, query_meta: dict) -> str:
    block_id     = query_meta.get("block_id", "?")
    anomaly_type = query_meta.get("anomaly_types", query_meta.get("primary_type", "unknown"))
    latency_ms   = query_meta.get("latency", 0)
    total_events = query_meta.get("total_events", 0)
    event_ref    = build_event_context(query_doc)

    seq_m     = re.search(r"Event Sequence\s*:\s*(.+?)(?:\n|$)", query_doc)
    event_seq = seq_m.group(1).strip() if seq_m else " -> ".join(re.findall(r"\bE\d+\b", query_doc))

    return f"""You are diagnosing an HDFS block anomaly. Return ONLY a JSON object — no markdown, no explanation.

BLOCK UNDER ANALYSIS:
- Block ID: {block_id}
- Anomaly Type: {anomaly_type}
- Total Events: {total_events}
- Latency: {latency_ms}ms
- Event Sequence: {event_seq}

EVENT DESCRIPTIONS (use these verbatim in event_explanations):
{event_ref}

SIMILAR HISTORICAL CASES:
{hist_ctx if hist_ctx else "No similar cases found."}

Return this JSON with real analysis in every field — no placeholders, no empty arrays:
{{
  "block_id": "{block_id}",
  "anomaly_type": "<one of: duplicate_pattern | repetition | missing_events | high_latency>",
  "summary": "<2 sentences describing what happened; must mention {total_events} events and {latency_ms}ms latency>",
  "root_cause": "<explain the failure mechanism; cite specific event IDs like E5, E11 as evidence>",
  "comparison_to_historical": "<one sentence comparing this block to the historical cases; include a specific latency number>",
  "mitigation_steps": {{
    "high":   ["<urgent action specific to {anomaly_type}>", "<urgent action 2>"],
    "medium": ["<follow-up action>", "<follow-up action 2>"],
    "low":    ["<long-term improvement>"]
  }},
  "event_explanations": {{
    "<event ID>": "<description from EVENT DESCRIPTIONS above — one entry per unique event in the sequence>"
  }}
}}"""


def generate_root_cause(query_doc: str, hist_ctx: str, query_meta: dict, similar_docs: list) -> dict:
    prompt = build_llm_prompt(query_doc, hist_ctx, query_meta)

    # Groq call with retry for rate limits and token-too-large
    MAX_RETRIES = 3
    response = None
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            response = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": (
                        "You are an HDFS anomaly expert. Return ONLY valid JSON. "
                        "Never write placeholder text like '...', 'urgent action 1', or 'follow-up 1'. "
                        "Every field must contain real, specific analysis."
                    )},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=1500,
            )
            break
        except Exception as e:
            last_error = e
            err = str(e)
            if "413" in err and attempt < MAX_RETRIES - 1:
                # Compress historical context and rebuild prompt
                compressed = "\n".join(
                    f"Case {i+1}: {r['block_id']} | {r['primary_type']} | {r['latency']}ms"
                    for i, r in enumerate(similar_docs)
                )
                prompt = build_llm_prompt(query_doc, compressed, query_meta)
            elif "429" in err and attempt < MAX_RETRIES - 1:
                time.sleep(5 * (attempt + 1))
            else:
                break

    if response is None:
        return {"error": str(last_error), "block_id": query_meta.get("block_id", "?")}

    content = response.choices[0].message.content.strip()

    # Parse
    try:
        parsed = repair_json(content)
    except Exception as e:
        print(f"[PARSE ERROR] {query_meta.get('block_id','?')} | {e} | {content[:200]}")
        parsed = {
            "block_id":                  query_meta.get("block_id", "?"),
            "summary":                   "JSON parse failed.",
            "root_cause":                content[:300],
            "comparison_to_historical":  "",
            "event_explanations":        {},
            "anomaly_type":              query_meta.get("primary_type", "unknown"),
            "mitigation_steps":          {"high": [], "medium": [], "low": []},
            "parse_error":               True,
        }

    # Enforce valid anomaly type
    if parsed.get("anomaly_type") not in VALID_ANOMALY_TYPES:
        parsed["anomaly_type"] = query_meta.get("primary_type", "unknown")

    # Fill empty mitigation tiers with typed fallbacks
    atype    = parsed.get("anomaly_type", query_meta.get("primary_type", "duplicate_pattern"))
    fallback = FALLBACK_MITIGATIONS.get(atype, FALLBACK_MITIGATIONS["duplicate_pattern"])
    mit      = parsed.get("mitigation_steps")
    if not isinstance(mit, dict):
        parsed["mitigation_steps"] = fallback
    else:
        for tier in ("high", "medium", "low"):
            cleaned = [x for x in (mit.get(tier) or []) if x and str(x).strip()]
            mit[tier] = cleaned if cleaned else fallback[tier]

    # Fix comparison_to_historical if it came back as a list or JSON fragment
    cth = parsed.get("comparison_to_historical", "")
    if isinstance(cth, (list, dict)) or (isinstance(cth, str) and cth.strip().startswith("[")):
        avg = int(sum(r["latency"] for r in similar_docs) / max(len(similar_docs), 1))
        parsed["comparison_to_historical"] = (
            f"Historical cases averaged {avg}ms latency vs this block's {query_meta.get('latency',0)}ms."
        )

    # Override confidence with deterministic computation
    confidence, label = compute_confidence(similar_docs, query_doc, query_meta.get("latency", 0))
    parsed["confidence"]       = confidence
    parsed["confidence_label"] = label

    return parsed


# ─────────────────────────────────────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="HDFS Anomaly Root Cause API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


class AnalyzeRequest(BaseModel):
    query:               Optional[str] = None
    block_id:            Optional[str] = None
    anomaly_type_filter: Optional[str] = None
    k:                   Optional[int] = 3


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs", "health": "/health", "blocks": "/blocks"}


@app.get("/health")
def health():
    return {
        "status":    "ok",
        "documents": len(documents),
        "vectors":   collection.count() if collection else 0,
    }


@app.get("/blocks")
def list_blocks(
    limit:        int = Query(default=20, ge=1, le=500),
    offset:       int = Query(default=0,  ge=0),
    anomaly_type: Optional[str] = None,
):
    """List known blocks. Supports pagination via limit/offset and filtering by anomaly_type."""
    filtered = [
        {"block_id": m["block_id"], "primary_type": m["primary_type"], "latency_ms": m["latency"]}
        for m in all_metadata
        if not anomaly_type or m["primary_type"] == anomaly_type
    ]
    return {"total": len(filtered), "offset": offset, "limit": limit, "blocks": filtered[offset:offset + limit]}


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    if not request.query and not request.block_id:
        raise HTTPException(400, "Provide 'query' or 'block_id'.")

    if request.block_id:
        if request.block_id not in block_lookup:
            raise HTTPException(404, f"block_id '{request.block_id}' not found. "
                                     f"Use GET /blocks to see available IDs.")
        q_doc, q_meta, _ = block_lookup[request.block_id]
        query_str    = request.block_id
        atype_filter = request.anomaly_type_filter or q_meta["primary_type"]
    else:
        # Free-text path: extract what we can from the query string itself
        q_doc        = request.query
        atype_filter = request.anomaly_type_filter
        q_meta = {
            "block_id":      "external_query",
            "primary_type":  atype_filter or "unknown",
            "anomaly_types": atype_filter or "unknown",
            "latency":       0,
            "total_events":  len(re.findall(r"\bE\d+\b", request.query)),
        }
        query_str = request.query

    similar = retrieve_similar(query_str, k=request.k or 3, anomaly_type_filter=atype_filter)

    hist_ctx = "\n\n".join(
        f"Case {i+1}\n" + compress_historical_case(r["document"], r["block_id"], r["latency"], r["distance"])
        for i, r in enumerate(similar)
        if r["block_id"] != q_meta.get("block_id", "")
    )

    result = generate_root_cause(q_doc, hist_ctx, q_meta, similar)
    result["retrieved_block_ids"] = [r["block_id"] for r in similar]
    result["query_block_id"]      = q_meta.get("block_id", "external_query")
    return result
