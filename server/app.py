from flask import Flask, request, jsonify
import pdfplumber
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import os
import uuid
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

# Store PDFs: {pdf_id: { "filename": str, "index": faiss.IndexFlatL2, "documents": [str] } }
pdf_store = {}

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

    pdf_store[pdf_id] = {
        "filename": filename,
        "index": index,
        "documents": documents
    }

    return jsonify({"success": True, "pdf_id": pdf_id, "filename": filename, "chunks": len(chunks)})


@app.route("/list_pdfs", methods=["GET"])
def list_pdfs():
    result = [{"pdf_id": pdf_id, "filename": data["filename"]} for pdf_id, data in pdf_store.items()]
    return jsonify(result)


@app.route("/ask", methods=["POST"])
def ask_question():
    data = request.json
    pdf_id = data.get("pdf_id", "").strip()
    question = data.get("question", "").strip()

    if pdf_id not in pdf_store:
        return jsonify({"error": "PDF not found"}), 404
    if not question:
        return jsonify({"error": "No question provided"}), 400

    pdf_data = pdf_store[pdf_id]
    index = pdf_data["index"]
    documents = pdf_data["documents"]

    # Retrieve top 3 chunks
    q_emb = get_embeddings(question).reshape(1, -1)
    D, I = index.search(q_emb, min(3, len(documents)))
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

    return jsonify({"answer": answer})


# ------------------------------
# Run App
# ------------------------------
if __name__ == "__main__":
    app.run(port=5000, debug=True)

