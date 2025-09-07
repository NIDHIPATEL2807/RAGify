from flask import Flask, request, jsonify
import pdfplumber
from flask_cors import CORS
from sklearn.feature_extraction.text import TfidfVectorizer
import faiss
import numpy as np

# ------------------------------
# App Setup
# ------------------------------
app = Flask(__name__)
CORS(app, origins="http://localhost:3000")  # Allow frontend requests

# ------------------------------
# Storage / FAISS Setup
# ------------------------------
documents = []          # store PDF text chunks
vectorizer = None       # TF-IDF vectorizer
chunks_vectors = None   # TF-IDF vectors
index = None            # FAISS index

CHUNK_SIZE = 500        # characters per chunk

# ------------------------------
# Helper Functions
# ------------------------------
def chunk_text(text, chunk_size=CHUNK_SIZE):
    """Split text into chunks"""
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size) if text[i:i+chunk_size].strip()]

# ------------------------------
# Routes
# ------------------------------
@app.route("/upload", methods=["POST"])
def upload_pdf():
    global documents, vectorizer, chunks_vectors, index

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]

    try:
        # Extract text from PDF
        with pdfplumber.open(file) as pdf:
            text = "".join([page.extract_text() or "" for page in pdf.pages])
        if not text.strip():
            return jsonify({"error": "PDF has no extractable text"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to read PDF: {str(e)}"}), 500

    # Split into chunks
    documents = chunk_text(text, CHUNK_SIZE)
    if not documents:
        return jsonify({"error": "No text chunks generated"}), 500

    # Vectorize chunks using TF-IDF
    vectorizer = TfidfVectorizer()
    chunks_vectors = vectorizer.fit_transform(documents).toarray().astype("float32")

    # Build FAISS index
    DIM = chunks_vectors.shape[1]
    index = faiss.IndexFlatL2(DIM)
    index.add(chunks_vectors)

    return jsonify({"success": True, "chunks": len(documents)})

@app.route("/ask", methods=["POST"])
def ask_question():
    global documents, vectorizer, chunks_vectors, index

    if not documents or index is None:
        return jsonify({"error": "No PDF uploaded yet"}), 400

    data = request.json
    question = data.get("question", "").strip()
    if not question:
        return jsonify({"error": "No question provided"}), 400

    try:
        # Vectorize question
        q_vec = vectorizer.transform([question]).toarray().astype("float32")

        # Search FAISS for top 3 relevant chunks
        D, I = index.search(q_vec, k=min(3, len(documents)))
        context = "\n".join([documents[i] for i in I[0]])

        # Return the relevant context as answer (extractive)
        return jsonify({"answer": context})

    except Exception as e:
        return jsonify({"error": f"Failed to process question: {str(e)}"}), 500

# ------------------------------
# Run App
# ------------------------------
if __name__ == "__main__":
    app.run(port=5000, debug=True)
