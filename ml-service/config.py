from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # Service
    ENV: str = "development"
    ML_SERVICE_SECRET: str  # required — shared secret for Next.js → ML auth (32+ chars)
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Model mode — "stub" uses Grok API, "mistral" uses fine-tuned local model
    MODEL_MODE: Literal["stub", "mistral"] = "stub"

    # Grok xAI (used in stub mode)
    GROK_API_KEY: str = ""

    # Mistral / HuggingFace (used in mistral mode)
    MISTRAL_MODEL_PATH: str = "/app/model/lawbridge-mistral-7b-lora"
    HF_BASE_MODEL: str = "mistralai/Mistral-7B-Instruct-v0.3"
    HF_TOKEN: str = ""  # required to download Mistral from HuggingFace Hub

    # Pinecone (optional — FAISS fallback when unset)
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "lawbridge-legal-corpus"
    PINECONE_ENVIRONMENT: str = "us-east-1-aws"

    # Supabase (for document indexing — required only when running indexer)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Embedding model (must match what was used to build the index)
    EMBEDDING_MODEL: str = "paraphrase-multilingual-mpnet-base-v2"

    # Cross-encoder reranker
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-12-v2"

    # Inference params
    MAX_NEW_TOKENS: int = 1024
    TEMPERATURE: float = 0.1  # Low temp for factual legal responses

    class Config:
        env_file = ".env.local"
        extra = "ignore"


settings = Settings()
