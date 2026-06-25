# LawBridge GH — ML Microservice Dockerfile
# Optimised for Railway deployment (CPU inference in stub mode)

FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for Docker layer caching
COPY ml-service/requirements.txt ./requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download embedding and reranker models at build time
# This avoids slow cold starts on Railway
RUN python -c "\
from sentence_transformers import SentenceTransformer, CrossEncoder; \
print('Downloading embedding model...'); \
SentenceTransformer('paraphrase-multilingual-mpnet-base-v2'); \
print('Downloading reranker...'); \
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-12-v2'); \
print('Models cached.')"

# Copy application code
COPY ml-service/ ./ml-service/

# Create corpus directory for FAISS index (persisted via Railway volume)
RUN mkdir -p /app/ml-service/corpus

# Create model directory (Mistral weights go here when switching modes)
RUN mkdir -p /app/model

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start server
CMD ["uvicorn", "ml-service.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
