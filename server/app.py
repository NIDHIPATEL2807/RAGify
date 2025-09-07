from flask import Flask, request, jsonify
import pdfplumber
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import os
import uuid
import pickle
from dotenv import load_dotenv
from flask_cors import CORS

# Optional Gemini AI
import google.generativeai as genai

# ------------------------------
# App Setup
# ------------------------------
app = Flask(__name__)
CORS(app, origins="http://localhost:3000")  # Frontend

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# ------------------------------
# Embedding Setup
# ------------------------------
DIMENSION = 384  # all-MiniLM-L6-v2
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# ------------------------------
# Storage & Cache
# ------------------------------
pdf_store = {}         # {pdf_id: {"filename": str, "index": faiss.IndexFlatL2, "documents": [str]}}
answer_cache = {}      # {(pdf_id, question): answer}
INDEX_DIR = "indexes"
os.makedirs(INDEX_DIR, exist_ok=True)

# ------------------------------
# Helper Functions
# ------------------------------
def get_embeddings(text: str):
    if not text.strip():
        return np.zeros(DIMENSION, dtype="float32")
    try:
        emb = embedder.encode(text)
        return np.array(emb, dtype="float32")
    except Exception as e:
        print(f"[Embedding Error]: {e}")
        return np.zeros(DIMENSION, dtype="float32")

def save_pdf_index(pdf_id, index, documents):
    faiss.write_index(index, os.path.join(INDEX_DIR, f"{pdf_id}.index"))
    with open(os.path.join(INDEX_DIR, f"{pdf_id}_docs.pkl"), "wb") as f:
        pickle.dump(documents, f)

def load_pdf_index(pdf_id):
    index_path = os.path.join(INDEX_DIR, f"{pdf_id}.index")
    docs_path = os.path.join(INDEX_DIR, f"{pdf_id}_docs.pkl")
    if os.path.exists(index_path) and os.path.exists(docs_path):
        index = faiss.read_index(index_path)
        with open(docs_path, "rb") as f:
            documents = pickle.load(f)
        return index, documents
    return None, None

# ------------------------------
# Routes
# ------------------------------
@app.route("/")
def home():
    return "PDF Q&A Backend Running"

@app.route("/upload", methods=["POST"])
def upload_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    filename = file.filename

    try:
        with pdfplumber.open(file) as pdf:
            text = "".join([page.extract_text() or "" for page in pdf.pages])
        if not text.strip():
            return jsonify({"error": "PDF has no extractable text"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to read PDF: {str(e)}"}), 500

    pdf_id = str(uuid.uuid4())
    chunks = [text[i:i+500] for i in range(0, len(text), 500) if text[i:i+500].strip()]

    index = faiss.IndexFlatL2(DIMENSION)
    documents = []

    for chunk in chunks:
        emb = get_embeddings(chunk)
        index.add(np.array([emb]))
        documents.append(chunk)

    pdf_store[pdf_id] = {"filename": filename, "index": index, "documents": documents}
    save_pdf_index(pdf_id, index, documents)

    return jsonify({"success": True, "pdf_id": pdf_id, "filename": filename, "chunks": len(chunks)})

@app.route("/list_pdfs", methods=["GET"])
def list_pdfs():
    # Load persistent indexes if not in memory
    for file in os.listdir(INDEX_DIR):
        if file.endswith(".index"):
            pdf_id = file.replace(".index", "")
            if pdf_id not in pdf_store:
                idx, docs = load_pdf_index(pdf_id)
                if idx and docs:
                    pdf_store[pdf_id] = {"filename": f"{pdf_id}.pdf", "index": idx, "documents": docs}

    result = [{"pdf_id": pdf_id, "filename": data["filename"]} for pdf_id, data in pdf_store.items()]
    return jsonify(result)

@app.route("/ask", methods=["POST"])
def ask_question():
    data = request.json
    pdf_id = data.get("pdf_id", "").strip()
    question = data.get("question", "").strip()

    if pdf_id not in pdf_store:
        # Try loading from disk
        idx, docs = load_pdf_index(pdf_id)
        if idx and docs:
            pdf_store[pdf_id] = {"filename": f"{pdf_id}.pdf", "index": idx, "documents": docs}
        else:
            return jsonify({"error": "PDF not found"}), 404
    if not question:
        return jsonify({"error": "No question provided"}), 400

    # Check cache first
    cache_key = (pdf_id, question)
    if cache_key in answer_cache:
        return jsonify({"answer": answer_cache[cache_key]})

    pdf_data = pdf_store[pdf_id]
    index = pdf_data["index"]
    documents = pdf_data["documents"]

    # Top-k retrieval
    top_k = min(3, len(documents))
    q_emb = get_embeddings(question).reshape(1, -1)
    D, I = index.search(q_emb, top_k)
    context = "\n".join([documents[i] for i in I[0]])

    answer = context  # fallback
    if GEMINI_API_KEY:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = f"""
You are an AI assistant. Use the context below to answer the question concisely and clearly.

Context:
{context}

Question:
{question}

Answer:
"""
            response = model.generate_content(prompt)
            answer = response.text if hasattr(response, "text") else str(response)
        except Exception as e:
            print(f"[Gemini API Error]: {e}")
            answer = "Could not fetch answer from Gemini API."

    # Save to cache
    answer_cache[cache_key] = answer
    return jsonify({"answer": answer})

# ------------------------------
# Run App
# ------------------------------
if __name__ == "__main__":
    app.run(port=5000, debug=True)
