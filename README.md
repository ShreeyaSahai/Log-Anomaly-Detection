# 🔍 Log Anomaly Detection & Root Cause Analysis (LAD)

An end-to-end AI system that detects anomalies in HDFS logs using a Transformer model, then performs automated root cause analysis via a RAG + LLM pipeline — surfaced through an interactive Next.js dashboard.

🌐 **Live Demo:** [https://log-anomaly-detection.vercel.app](https://log-anomaly-detection.vercel.app)

---

## ⚙️ How It Works

```
Uploaded Logs → ML Anomaly Detection → Event Parser → RAG Retrieval → LLM Analysis → Dashboard
```

1. User uploads a log file or pastes a query in the dashboard
2. Transformer model classifies each block as `Fail` / `Success`
3. Anomalous blocks are converted into structured RAG documents
4. ChromaDB retrieves similar historical cases (top-k)
5. Groq LLM generates root cause, event explanations & remediation steps
6. Results render in the Next.js dashboard

---

## 📂 Dataset

| Property | Detail |
|---|---|
| Source | [HDFS Event Traces](https://zenodo.org/records/8196385/files/HDFS_v1.zip?download=1) |
| Total rows | 33,676 blocks |
| Class balance | 50% Fail / 50% Success — rebalanced |
| Key columns | `BlockId`, `Label`, `Features` (event list), `Latency` (ms) |
| Event vocabulary | 29 unique IDs (E1–E29) mapped via Drain log parser |
| Latency range | 0 ms → 53,924 ms |

---

## Project Structure

```
LAD/
├── dataset/
│   ├── balanced_log_dataset.csv     # 33,676 rows 
│   └── HDFS_log_templates.csv       # 29 Drain-parsed event templates (E1–E29)
├── notebooks/
│   ├── ml
│   │    └── LAD3_Anomaly_detection_Transformer.ipynb   # Model training
│   ├── rag
│   │    └── LAD4_rag_document_generation.ipynb         # RAG doc builder
│   ├── llm
│   │    └── LAD5_llm_root_cause_analysis.ipynb         # LLM + ChromaDB pipeline
├── results/                        # Saved evaluation outputs & plots
├── frontend/                        # Next.js 14 dashboard
├── main.py                          # FastAPI backend
├── requirements.txt
├── render.yaml                      # Render deployment config
└── runtime.txt                      # Python 3.10 pin
```

---

## 📓 Notebooks

| Notebook | What it does |
|---|---|
| **LAD3** — Anomaly Detection Transformer | Trains a 2-layer Transformer classifier on event sequences + latency to predict `Fail` / `Success` for each HDFS block. Produces `transformer_model.pt`, `event2idx.json`, and `scaler.pkl`. |
| **LAD4** — RAG Document Generation | Converts anomalous block rows into rich structured text documents (summary, root cause, event details) and ingests them into ChromaDB with semantic embeddings for retrieval. |
| **LAD5** — LLM Root Cause Analysis | Queries ChromaDB for top-k similar cases, builds a context window, and calls the Groq LLM to return a structured JSON analysis with root cause, confidence, event explanations, and remediation steps. |

---

## 🚨 Anomaly Profiles

| Type | What it means |
|---|---|
| `repetition` | DataNode stuck in retry storm |
| `missing_events` | Pipeline aborted before completion |
| `high_latency` | Severe timing bottleneck or stall |
| `duplicate_pattern` | Idempotent retries or race condition |

---

## 🛠️ Tech Stack

### 🤖 AI / ML
| | |
|---|---|
| PyTorch | Transformer model training & inference |
| scikit-learn | StandardScaler, SMOTE balancing |
| sentence-transformers | Semantic embeddings (`all-MiniLM-L6-v2`) |
| ChromaDB | Vector store for RAG retrieval |
| Groq API | LLM inference (`llama-3.3-70b-versatile`) |

### 🖥️ Backend
| | |
|---|---|
| FastAPI | REST API framework |
| uvicorn | ASGI server |
| pandas / numpy | Data processing & parsing |
| python-multipart | File upload handling |

### 🎨 Frontend
| | |
|---|---|
| Next.js 14 (App Router) | React framework |
| TypeScript | Type safety |
| Tailwind CSS v4 | Styling |
| Framer Motion | Pipeline loading animations |
| Lucide React | Icons |

---

## 🚀 Setup

### Backend
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Generate artefacts by running notebooks in order: LAD3 → LAD4 → LAD5

uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

---

## ☁️ Deployment

- **Backend** — Render Web Service, configured via `render.yaml` and `runtime.txt` (Python 3.10). Set `GROQ_API_KEY` in the Render dashboard environment variables.
- **Frontend** — Vercel. Set `NEXT_PUBLIC_API_URL` to the Render backend URL.
