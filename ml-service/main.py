"""
LawBridge GH — ML Microservice
FastAPI service handling RAG retrieval + LLM inference.
MODEL_MODE=stub  → Uses Anthropic Claude API (fast, no GPU needed)
MODEL_MODE=mistral → Uses fine-tuned Mistral 7B + LoRA adapter (requires GPU/high RAM)
"""

import os
import time
import logging
from contextlib import asynccontextmanager
from typing import Optional
import uuid

from fastapi import FastAPI, HTTPException, Security, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import settings
from .retrieval import retrieval_pipeline, initialize_retrieval
from .inference import get_inference_engine
from .safety import safety_check

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("lawbridge.ml")

# ─── Startup / shutdown ───────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting LawBridge ML Service — mode: {settings.MODEL_MODE}")
    logger.info("ML_SERVICE_SECRET configured")
    await initialize_retrieval()
    logger.info("Retrieval pipeline ready")
    yield
    logger.info("Shutting down ML service")

app = FastAPI(
    title="LawBridge GH ML Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENV != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restricted by secret key — internal service
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Auth ─────────────────────────────────────────────────────────────────────

security = HTTPBearer(auto_error=False)

def verify_service_secret(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    x_service_secret: Optional[str] = Header(None),
) -> None:
    """Verify that the request comes from our Next.js service."""
    token = None
    if credentials:
        token = credentials.credentials
    if not token and x_service_secret:
        token = x_service_secret

    if token != settings.ML_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid service secret")

# ─── Models ───────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=5, max_length=5000)
    mode: str = Field(default="rights", pattern="^(rights|letter|both)$")
    user_id: Optional[str] = None

class RetrievedChunk(BaseModel):
    source_act: str
    article_number: Optional[str] = None
    section_number: Optional[str] = None
    text: str
    score: float

class QueryResponse(BaseModel):
    rights_response: Optional[str] = None
    letter_response: Optional[str] = None
    cited_articles: list[str]
    retrieved_chunks: list[RetrievedChunk]
    latency_ms: int
    model_mode: str

class HealthResponse(BaseModel):
    status: str
    model_mode: str
    pinecone_connected: bool
    version: str

class IndexRequest(BaseModel):
    document_id: str

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    from .retrieval import is_pinecone_connected
    return HealthResponse(
        status="ok",
        model_mode=settings.MODEL_MODE,
        pinecone_connected=is_pinecone_connected(),
        version="1.0.0",
    )

@app.post("/query", response_model=QueryResponse)
async def query(
    req: QueryRequest,
    _: None = Depends(verify_service_secret),
):
    start = time.monotonic()

    try:
        # Stage 1 + 2: RAG retrieval (vector search + cross-encoder rerank)
        chunks = await retrieval_pipeline(req.query, top_k_recall=20, top_k_final=5)

        # Build cited articles list from chunk metadata
        cited = []
        for chunk in chunks:
            parts = [chunk.source_act]
            if chunk.article_number:
                parts.append(f"Art. {chunk.article_number}")
            elif chunk.section_number:
                parts.append(f"§{chunk.section_number}")
            cited_ref = " ".join(parts)
            if cited_ref not in cited:
                cited.append(cited_ref)

        # Inference
        engine = get_inference_engine()
        rights_response = None
        letter_response = None

        if req.mode in ("rights", "both"):
            rights_response = await engine.generate_rights_response(
                query=req.query,
                chunks=chunks,
            )
            # Safety check
            rights_response = safety_check(rights_response, cited)

        if req.mode in ("letter", "both"):
            letter_response = await engine.generate_letter(
                query=req.query,
                chunks=chunks,
            )

        latency_ms = int((time.monotonic() - start) * 1000)
        logger.info(f"Query processed in {latency_ms}ms | mode={req.mode} | chunks={len(chunks)}")

        return QueryResponse(
            rights_response=rights_response,
            letter_response=letter_response,
            cited_articles=cited,
            retrieved_chunks=[
                RetrievedChunk(
                    source_act=c.source_act,
                    article_number=c.article_number,
                    section_number=c.section_number,
                    text=c.text[:500],  # truncate for response size
                    score=round(c.score, 4),
                )
                for c in chunks
            ],
            latency_ms=latency_ms,
            model_mode=settings.MODEL_MODE,
        )

    except Exception as e:
        logger.error(f"Query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/corpus/index")
async def index_document(
    req: IndexRequest,
    _: None = Depends(verify_service_secret),
):
    """Trigger corpus indexing for a document. Called by Next.js admin API."""
    from .indexer import index_document_async
    import asyncio


    job_id = str(uuid.uuid4())
    # Fire and forget — status tracked in Supabase corpus_jobs table
    asyncio.create_task(index_document_async(req.document_id, job_id))

    return {"job_id": job_id, "status": "queued"}
