"""
Inference engine with two modes:
  stub    — Calls Anthropic Claude API. Zero GPU, production-quality output.
            Use this until fine-tuned Mistral weights are ready.
  mistral — Loads fine-tuned Mistral 7B + LoRA adapter locally.
            Swap to this mode after completing the LoRA fine-tuning pipeline.
"""

import logging
from typing import Optional
from abc import ABC, abstractmethod

from .config import settings
from .retrieval import LegalChunk

logger = logging.getLogger("lawbridge.inference")

# ─── System prompts ───────────────────────────────────────────────────────────

RIGHTS_SYSTEM_PROMPT = """You are LawBridge GH, an AI legal information assistant specialising in Ghanaian law. Your role is to help everyday Ghanaian citizens understand their legal rights based on Ghana's Constitution and statutory law.

CRITICAL RULES:
1. Base ALL responses strictly on the provided legal context. Do not cite laws not in the context.
2. Every legal claim MUST cite the specific Act and Article/Section number (e.g. "Labour Act 651, Section 68").
3. Use plain, simple English — secondary-school reading level. No legal jargon without explanation.
4. Always end with the exact disclaimer: "⚖️ This is legal information, not legal advice. For your specific situation, consult a qualified Ghanaian lawyer."
5. Never fabricate statute references. If the context doesn't cover the question, say so clearly.
6. Structure your response in clear paragraphs. Be direct and practical.

FORMAT:
- Start by clearly stating what rights the person has
- Explain what the law says (cite specific provisions)
- Explain what they can do next (practical steps)
- End with the mandatory disclaimer"""

LETTER_SYSTEM_PROMPT = """You are LawBridge GH, helping a Ghanaian citizen draft a formal legal letter asserting their rights.

CRITICAL RULES:
1. Base the letter strictly on the provided legal context and cited Acts.
2. Use formal but clear letter format appropriate for Ghana.
3. Cite specific legal provisions in the letter body.
4. Include clear placeholders like [YOUR FULL NAME], [YOUR ADDRESS], [DATE], [RECIPIENT NAME], [RECIPIENT ADDRESS].
5. Keep the tone firm, professional, and factual — not aggressive.
6. Include a clear statement of the relief or action requested.
7. Sign off: "[YOUR FULL NAME]" with a note to add contact details.

Write only the letter — no preamble or explanation outside the letter itself."""

CONTEXT_TEMPLATE = """LEGAL CONTEXT (Ghana's statutes — use only these sources):
{chunks}

CITIZEN'S SITUATION:
{query}"""


def _format_chunks(chunks: list[LegalChunk]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, 1):
        ref = f"{chunk.source_act}"
        if chunk.article_number:
            ref += f", Article {chunk.article_number}"
        if chunk.section_number:
            ref += f", Section {chunk.section_number}"
        parts.append(f"[Source {i}: {ref}]\n{chunk.text}")
    return "\n\n---\n\n".join(parts)


# ─── Base engine interface ────────────────────────────────────────────────────

class InferenceEngine(ABC):
    @abstractmethod
    async def generate_rights_response(self, query: str, chunks: list[LegalChunk]) -> str: ...

    @abstractmethod
    async def generate_letter(self, query: str, chunks: list[LegalChunk]) -> str: ...


# ─── Stub engine (Claude API) ─────────────────────────────────────────────────

class StubInferenceEngine(InferenceEngine):
    """
    Uses Grok (xAI) as the LLM backend via OpenAI-compatible API.
    Production-quality output with no GPU requirement.
    Replace with MistralInferenceEngine once fine-tuning is complete.
    """

    def __init__(self):
        from openai import AsyncOpenAI
        self._client = AsyncOpenAI(
            api_key=settings.GROK_API_KEY,
            base_url="https://api.x.ai/v1",
        )
        self._model = "grok-3"
        logger.info(f"StubInferenceEngine initialised with Grok (model={self._model})")

    async def _generate(self, system: str, user_content: str) -> str:
        msg = await self._client.chat.completions.create(
            model=self._model,
            max_tokens=1500,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        )
        return msg.choices[0].message.content

    async def generate_rights_response(self, query: str, chunks: list[LegalChunk]) -> str:
        if not chunks:
            return (
                "I could not find specific provisions in Ghana's statutes that directly address your situation "
                "in my current legal corpus. I recommend consulting a qualified Ghanaian lawyer for advice specific to your case.\n\n"
                "⚖️ This is legal information, not legal advice. For your specific situation, consult a qualified Ghanaian lawyer."
            )

        user_content = CONTEXT_TEMPLATE.format(
            chunks=_format_chunks(chunks),
            query=query,
        )
        return await self._generate(RIGHTS_SYSTEM_PROMPT, user_content)

    async def generate_letter(self, query: str, chunks: list[LegalChunk]) -> str:
        user_content = CONTEXT_TEMPLATE.format(
            chunks=_format_chunks(chunks) if chunks else "No specific statutory context retrieved.",
            query=query,
        )
        return await self._generate(LETTER_SYSTEM_PROMPT, user_content)


# ─── Mistral engine (fine-tuned local model) ──────────────────────────────────

class MistralInferenceEngine(InferenceEngine):
    """
    Uses the fine-tuned Mistral 7B + LoRA adapter.
    Requires:
      - MISTRAL_MODEL_PATH pointing to the merged/adapter weights directory
      - Sufficient RAM/VRAM (4-bit quantised: ~6GB VRAM or ~14GB RAM)
    
    SETUP:
      1. Complete the LoRA fine-tuning (see training/README.md)
      2. Set MODEL_MODE=mistral in Railway environment
      3. Set MISTRAL_MODEL_PATH=/app/model/lawbridge-mistral-7b-lora
      4. Redeploy the Railway container
    """

    def __init__(self):
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
        from peft import PeftModel

        logger.info(f"Loading Mistral 7B from {settings.MISTRAL_MODEL_PATH}")

        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
        )

        self._tokenizer = AutoTokenizer.from_pretrained(
            settings.MISTRAL_MODEL_PATH,
            trust_remote_code=True,
        )

        base = AutoModelForCausalLM.from_pretrained(
            settings.HF_BASE_MODEL,
            quantization_config=bnb_config,
            device_map="auto",
            trust_remote_code=True,
            token=settings.HF_TOKEN or None,
        )

        # Load LoRA adapter on top of base model
        self._model = PeftModel.from_pretrained(base, settings.MISTRAL_MODEL_PATH)
        self._model.eval()

        logger.info("Mistral 7B + LoRA adapter loaded successfully")

    def _format_prompt(self, system: str, user: str) -> str:
        """Mistral instruction format."""
        return f"[INST] {system}\n\n{user} [/INST]"

    def _run_inference(self, prompt: str) -> str:
        import torch

        inputs = self._tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=3072,
        ).to(self._model.device)

        with torch.no_grad():
            output_ids = self._model.generate(
                **inputs,
                max_new_tokens=settings.MAX_NEW_TOKENS,
                temperature=settings.TEMPERATURE,
                do_sample=settings.TEMPERATURE > 0,
                pad_token_id=self._tokenizer.eos_token_id,
                eos_token_id=self._tokenizer.eos_token_id,
            )

        # Decode only new tokens
        new_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
        return self._tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

    async def generate_rights_response(self, query: str, chunks: list[LegalChunk]) -> str:
        import asyncio
        if not chunks:
            return (
                "I could not find relevant provisions in my legal corpus for your situation. "
                "Please consult a qualified Ghanaian lawyer.\n\n"
                "⚖️ This is legal information, not legal advice. For your specific situation, consult a qualified Ghanaian lawyer."
            )

        user_content = CONTEXT_TEMPLATE.format(
            chunks=_format_chunks(chunks),
            query=query,
        )
        prompt = self._format_prompt(RIGHTS_SYSTEM_PROMPT, user_content)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._run_inference, prompt)

    async def generate_letter(self, query: str, chunks: list[LegalChunk]) -> str:
        import asyncio
        user_content = CONTEXT_TEMPLATE.format(
            chunks=_format_chunks(chunks) if chunks else "General Ghanaian law context.",
            query=query,
        )
        prompt = self._format_prompt(LETTER_SYSTEM_PROMPT, user_content)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._run_inference, prompt)


# ─── Engine factory ───────────────────────────────────────────────────────────

_engine: Optional[InferenceEngine] = None


def get_inference_engine() -> InferenceEngine:
    global _engine
    if _engine is None:
        if settings.MODEL_MODE == "mistral":
            _engine = MistralInferenceEngine()
        else:
            _engine = StubInferenceEngine()
    return _engine
