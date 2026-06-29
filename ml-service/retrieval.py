"""
Two-stage retrieval pipeline:
  Stage 1 — Dense vector search (Pinecone or FAISS fallback) → top-20 candidates
  Stage 2 — Cross-encoder reranker → top-5 final chunks
"""

import logging
import asyncio
from dataclasses import dataclass
from typing import Optional

import numpy as np

from .config import settings

logger = logging.getLogger("lawbridge.retrieval")

# ─── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class LegalChunk:
    id: str
    source_act: str
    text: str
    score: float
    article_number: Optional[str] = None
    section_number: Optional[str] = None
    chapter: Optional[str] = None
    effective_date: Optional[str] = None

# ─── Globals (loaded once at startup) ─────────────────────────────────────────

_embedder = None
_reranker = None
_pinecone_index = None
_faiss_index = None
_faiss_metadata: list[dict] = []
_pinecone_ok = False


def is_pinecone_connected() -> bool:
    return _pinecone_ok


async def initialize_retrieval():
    """Load embedding model, reranker, and connect to vector store."""
    global _embedder, _reranker, _pinecone_index, _pinecone_ok

    loop = asyncio.get_event_loop()

    # Load sentence-transformer embedding model
    logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
    def _load_embedder():
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer(settings.EMBEDDING_MODEL)

    _embedder = await loop.run_in_executor(None, _load_embedder)
    logger.info("Embedding model loaded")

    # Load cross-encoder reranker
    logger.info(f"Loading reranker: {settings.RERANKER_MODEL}")
    def _load_reranker():
        from sentence_transformers import CrossEncoder
        return CrossEncoder(settings.RERANKER_MODEL)

    _reranker = await loop.run_in_executor(None, _load_reranker)
    logger.info("Reranker loaded")

    # Try Pinecone first
    if settings.PINECONE_API_KEY:
        try:
            from pinecone import Pinecone
            pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            _pinecone_index = pc.Index(settings.PINECONE_INDEX_NAME)
            stats = _pinecone_index.describe_index_stats()
            logger.info(f"Pinecone connected — {stats.total_vector_count} vectors")
            _pinecone_ok = True
        except Exception as e:
            logger.warning(f"Pinecone unavailable ({e}), falling back to FAISS")
            _pinecone_ok = False
            await _load_faiss()
    else:
        logger.info("No Pinecone key — using FAISS")
        await _load_faiss()


async def _load_faiss():
    """Load FAISS index from disk if it exists."""
    global _faiss_index, _faiss_metadata
    import os
    import json

    faiss_path = os.path.join(os.path.dirname(__file__), "corpus", "index.faiss")
    meta_path = os.path.join(os.path.dirname(__file__), "corpus", "metadata.json")

    if not os.path.exists(faiss_path):
        logger.warning("No FAISS index found at corpus/index.faiss — retrieval will return empty results until corpus is indexed")
        return

    def _load():
        import faiss
        idx = faiss.read_index(faiss_path)
        with open(meta_path, "r") as f:
            meta = json.load(f)
        return idx, meta

    loop = asyncio.get_event_loop()
    _faiss_index, _faiss_metadata = await loop.run_in_executor(None, _load)
    logger.info(f"FAISS index loaded — {_faiss_index.ntotal} vectors")


# ─── Embedding ────────────────────────────────────────────────────────────────

def _embed(text: str) -> np.ndarray:
    """Embed a single text string."""
    vec = _embedder.encode([text], normalize_embeddings=True)
    return vec[0].astype(np.float32)


# ─── Stage 1: Vector search ───────────────────────────────────────────────────

async def _vector_search(query_vec: np.ndarray, top_k: int) -> list[dict]:
    """Return top-k candidate chunks from Pinecone or FAISS."""
    loop = asyncio.get_event_loop()

    if _pinecone_ok and _pinecone_index is not None:
        def _search():
            res = _pinecone_index.query(
                vector=query_vec.tolist(),
                top_k=top_k,
                include_metadata=True,
            )
            candidates = []
            for match in res.matches:
                meta = match.metadata or {}
                candidates.append({
                    "id": match.id,
                    "score": float(match.score),
                    "text": meta.get("text", ""),
                    "source_act": meta.get("source_act", "Unknown Act"),
                    "article_number": meta.get("article_number"),
                    "section_number": meta.get("section_number"),
                    "chapter": meta.get("chapter"),
                    "effective_date": meta.get("effective_date"),
                })
            return candidates
        return await loop.run_in_executor(None, _search)

    elif _faiss_index is not None:
        def _search():
            q = query_vec.reshape(1, -1)
            scores, indices = _faiss_index.search(q, min(top_k, _faiss_index.ntotal))
            candidates = []
            for score, idx in zip(scores[0], indices[0]):
                if idx < 0 or idx >= len(_faiss_metadata):
                    continue
                meta = _faiss_metadata[idx]
                meta["score"] = float(score)
                candidates.append(meta)
            return candidates
        return await loop.run_in_executor(None, _search)

    else:
        logger.warning("No vector index available — returning empty retrieval")
        return []


# ─── Stage 2: Cross-encoder reranker ─────────────────────────────────────────

def _rerank(query: str, candidates: list[dict], top_k: int) -> list[dict]:
    """Score all candidates with cross-encoder and return top-k."""
    if not candidates:
        return []

    pairs = [[query, c["text"]] for c in candidates]
    scores = _reranker.predict(pairs)

    ranked = sorted(
        zip(candidates, scores),
        key=lambda x: x[1],
        reverse=True,
    )

    result = []
    for cand, score in ranked[:top_k]:
        cand = dict(cand)
        cand["rerank_score"] = float(score)
        result.append(cand)
    return result


# ─── Public pipeline ──────────────────────────────────────────────────────────

async def retrieval_pipeline(
    query: str,
    top_k_recall: int = 20,
    top_k_final: int = 5,
) -> list[LegalChunk]:
    """
    Full two-stage retrieval:
      1. Embed query
      2. Vector search → top_k_recall candidates
      3. Cross-encoder rerank → top_k_final chunks
    """
    if _embedder is None:
        raise RuntimeError("Retrieval pipeline not initialized")

    loop = asyncio.get_event_loop()

    # Embed query
    query_vec = await loop.run_in_executor(None, _embed, query)

    # Stage 1: vector search
    candidates = await _vector_search(query_vec, top_k_recall)

    if not candidates:
        logger.warning("Stage 1 returned 0 candidates")
        return []

    # Stage 2: rerank
    reranked = await loop.run_in_executor(None, _rerank, query, candidates, top_k_final)

    chunks = [
        LegalChunk(
            id=c.get("id", f"chunk_{i}"),
            source_act=c.get("source_act", "Unknown Act"),
            text=c.get("text", ""),
            score=c.get("rerank_score", c.get("score", 0.0)),
            article_number=c.get("article_number"),
            section_number=c.get("section_number"),
            chapter=c.get("chapter"),
            effective_date=c.get("effective_date"),
        )
        for i, c in enumerate(reranked)
    ]

    logger.info(
        f"Retrieval complete — Stage1={len(candidates)} → Stage2={len(chunks)} | "
        f"top score={chunks[0].score:.4f if chunks else 0}"
    )
    return chunks
