"""
Legal corpus indexer.
Downloads a legal document PDF from Supabase Storage, chunks it,
generates embeddings, and upserts into Pinecone (or FAISS on disk).

Called by the FastAPI /corpus/index endpoint when admin triggers re-indexing.
"""

import json
import logging
import asyncio
import hashlib
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

import httpx

from .config import settings

logger = logging.getLogger("lawbridge.indexer")

CORPUS_DIR = Path(__file__).parent / "corpus"
CORPUS_DIR.mkdir(exist_ok=True)

CHUNK_SIZE = 512        # tokens approx (we use chars as proxy: ~4 chars/token)
CHUNK_OVERLAP = 64
CHARS_PER_TOKEN = 4
MAX_CHARS = CHUNK_SIZE * CHARS_PER_TOKEN
OVERLAP_CHARS = CHUNK_OVERLAP * CHARS_PER_TOKEN


@dataclass
class DocumentChunk:
    id: str
    text: str
    source_act: str
    article_number: Optional[str]
    section_number: Optional[str]
    chapter: Optional[str]
    char_start: int
    char_end: int


# ─── PDF extraction ───────────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using PyMuPDF (fitz)."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = []
        for page in doc:
            pages.append(page.get_text("text"))
        return "\n".join(pages)
    except ImportError:
        # Fallback: pypdf
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages)


# ─── Chunking ─────────────────────────────────────────────────────────────────

def chunk_legal_text(
    text: str,
    source_act: str,
) -> list[DocumentChunk]:
    """
    Chunk legal text, attempting to preserve Article/Section boundaries.
    Uses a sliding window with overlap when boundaries can't be found.
    """
    import re

    # Article/Section boundary patterns for Ghana statutes
    boundary_re = re.compile(
        r"(?:^|\n)(?:ARTICLE|Article|SECTION|Section)\s+(\d+[A-Za-z]?)",
        re.MULTILINE,
    )

    chunks: list[DocumentChunk] = []
    boundaries = [(m.start(), m.group(1)) for m in boundary_re.finditer(text)]

    if len(boundaries) >= 2:
        # Split on article/section boundaries
        for i, (start, art_num) in enumerate(boundaries):
            end = boundaries[i + 1][0] if i + 1 < len(boundaries) else len(text)
            segment = text[start:end].strip()

            if not segment:
                continue

            # Sub-chunk if segment is too large
            if len(segment) <= MAX_CHARS:
                chunk_id = hashlib.md5(f"{source_act}_{art_num}_{start}".encode()).hexdigest()
                chunks.append(DocumentChunk(
                    id=chunk_id,
                    text=segment,
                    source_act=source_act,
                    article_number=art_num,
                    section_number=None,
                    chapter=None,
                    char_start=start,
                    char_end=end,
                ))
            else:
                # Sliding window sub-chunks
                pos = 0
                sub_i = 0
                while pos < len(segment):
                    sub_end = min(pos + MAX_CHARS, len(segment))
                    sub_text = segment[pos:sub_end].strip()
                    if sub_text:
                        chunk_id = hashlib.md5(f"{source_act}_{art_num}_{start}_{sub_i}".encode()).hexdigest()
                        chunks.append(DocumentChunk(
                            id=chunk_id,
                            text=sub_text,
                            source_act=source_act,
                            article_number=art_num,
                            section_number=None,
                            chapter=None,
                            char_start=start + pos,
                            char_end=start + sub_end,
                        ))
                    pos += MAX_CHARS - OVERLAP_CHARS
                    sub_i += 1
    else:
        # Fallback: pure sliding window
        pos = 0
        i = 0
        while pos < len(text):
            end = min(pos + MAX_CHARS, len(text))
            seg = text[pos:end].strip()
            if seg:
                chunk_id = hashlib.md5(f"{source_act}_{pos}".encode()).hexdigest()
                chunks.append(DocumentChunk(
                    id=chunk_id,
                    text=seg,
                    source_act=source_act,
                    article_number=None,
                    section_number=None,
                    chapter=None,
                    char_start=pos,
                    char_end=end,
                ))
            pos += MAX_CHARS - OVERLAP_CHARS
            i += 1

    logger.info(f"Chunked '{source_act}' → {len(chunks)} chunks")
    return chunks


# ─── Embedding + upsert ───────────────────────────────────────────────────────

def embed_and_upsert_chunks(chunks: list[DocumentChunk], embedder) -> int:
    """Embed all chunks and upsert into Pinecone or FAISS."""
    if not chunks:
        return 0

    texts = [c.text for c in chunks]
    vectors = embedder.encode(texts, normalize_embeddings=True, batch_size=32, show_progress_bar=True)

    upserted = 0

    if settings.PINECONE_API_KEY:
        from pinecone import Pinecone
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        index = pc.Index(settings.PINECONE_INDEX_NAME)

        batch_size = 100
        for i in range(0, len(chunks), batch_size):
            batch_chunks = chunks[i:i + batch_size]
            batch_vecs = vectors[i:i + batch_size]
            records = []
            for chunk, vec in zip(batch_chunks, batch_vecs):
                records.append({
                    "id": chunk.id,
                    "values": vec.tolist(),
                    "metadata": {
                        "text": chunk.text,
                        "source_act": chunk.source_act,
                        "article_number": chunk.article_number or "",
                        "section_number": chunk.section_number or "",
                        "chapter": chunk.chapter or "",
                    },
                })
            index.upsert(vectors=records)
            upserted += len(records)
            logger.info(f"Upserted batch {i // batch_size + 1} ({upserted}/{len(chunks)}) to Pinecone")

    else:
        # FAISS: rebuild full index on disk
        import faiss
        import numpy as np

        faiss_path = CORPUS_DIR / "index.faiss"
        meta_path = CORPUS_DIR / "metadata.json"

        # Load existing metadata if present
        existing_meta: list[dict] = []
        if meta_path.exists():
            with open(meta_path) as f:
                existing_meta = json.load(f)

        existing_ids = {m["id"] for m in existing_meta}
        new_meta = list(existing_meta)
        new_vecs = []

        for chunk, vec in zip(chunks, vectors):
            if chunk.id not in existing_ids:
                new_meta.append({
                    "id": chunk.id,
                    "text": chunk.text,
                    "source_act": chunk.source_act,
                    "article_number": chunk.article_number,
                    "section_number": chunk.section_number,
                    "chapter": chunk.chapter,
                    "score": 0.0,
                })
                new_vecs.append(vec)

        if new_vecs:
            dim = vectors.shape[1]
            if faiss_path.exists():
                idx = faiss.read_index(str(faiss_path))
                idx.add(np.array(new_vecs, dtype=np.float32))
            else:
                idx = faiss.IndexFlatIP(dim)
                idx.add(np.array(new_vecs, dtype=np.float32))

            faiss.write_index(idx, str(faiss_path))
            with open(meta_path, "w") as f:
                json.dump(new_meta, f)

            upserted = len(new_vecs)
            logger.info(f"FAISS index updated — {idx.ntotal} total vectors")

    return upserted


# ─── Main indexing task ───────────────────────────────────────────────────────

async def index_document_async(document_id: str, job_id: str):
    """
    Full indexing pipeline for a single document.
    Updates Supabase corpus_jobs status throughout.
    """
    from supabase import create_client
    from sentence_transformers import SentenceTransformer

    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    async def update_job(status: str, error: str = None):
        update = {"status": status}
        if error:
            update["error_message"] = error
        if status == "processing":
            update["started_at"] = "now()"
        if status in ("done", "failed"):
            update["completed_at"] = "now()"
        supabase.table("corpus_jobs").update(update).eq("id", job_id).execute()

    try:
        await update_job("processing")

        # Fetch document metadata from Supabase
        result = supabase.table("legal_documents").select("*").eq("id", document_id).single().execute()
        doc = result.data
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        file_url: str = doc["file_url"]
        source_act: str = doc["act_name"]

        # Download PDF
        logger.info(f"Downloading {source_act} from {file_url}")
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.get(file_url)
            resp.raise_for_status()
            pdf_bytes = resp.content

        # Extract text
        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(None, extract_text_from_pdf, pdf_bytes)
        logger.info(f"Extracted {len(text)} chars from {source_act}")

        # Chunk
        chunks = await loop.run_in_executor(None, chunk_legal_text, text, source_act)

        # Load embedder (reuse from retrieval module if available)
        embedder = SentenceTransformer(settings.EMBEDDING_MODEL)

        # Embed + upsert
        upserted = await loop.run_in_executor(None, embed_and_upsert_chunks, chunks, embedder)

        # Update document metadata
        supabase.table("legal_documents").update({
            "chunk_count": len(chunks),
            "last_indexed_at": "now()",
        }).eq("id", document_id).execute()

        await update_job("done")
        logger.info(f"Indexed '{source_act}' — {upserted} vectors upserted")

    except Exception as e:
        logger.error(f"Indexing failed for doc {document_id}: {e}", exc_info=True)
        await update_job("failed", error=str(e))
