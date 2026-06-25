"""
Safety layer for LawBridge GH responses.
  1. Citation verifier — checks cited Articles/Sections exist in retrieved chunks
  2. Hallucination flag — warns if model cites non-existent provisions
  3. Disclaimer injector — ensures mandatory legal disclaimer is always present
"""

import re
import logging
from typing import Optional

logger = logging.getLogger("lawbridge.safety")

MANDATORY_DISCLAIMER = (
    "⚖️ This is legal information, not legal advice. "
    "For your specific situation, consult a qualified Ghanaian lawyer."
)

# Known Ghana statutes — used to detect potentially hallucinated act names
KNOWN_ACTS = {
    "Labour Act 651",
    "Labour Act",
    "Rent Act 220",
    "Rent Act",
    "Criminal Offences Act 29",
    "Criminal Offences Act",
    "Constitution",
    "1992 Constitution",
    "Ghana Constitution",
    "Consumer Protection Act 890",
    "Consumer Protection Act",
    "Domestic Violence Act 732",
    "Domestic Violence Act",
    "Children's Act 560",
    "Children's Act",
    "Factories, Offices and Shops Act 328",
    "Companies Act 992",
    "Evidence Act 323",
    "Courts Act 459",
    "Legal Profession Act 32",
}

# Regex to find article/section citations in model output
CITATION_RE = re.compile(
    r"(?:Article|Art\.|Section|§|Sec\.)\s*(\d+[A-Za-z]?(?:\(\d+\))?)",
    re.IGNORECASE,
)


def _extract_cited_refs(text: str) -> list[str]:
    """Extract all article/section references from model output."""
    return CITATION_RE.findall(text)


def _refs_from_chunks(chunks_text: list[str]) -> set[str]:
    """Build set of all article/section numbers present in retrieved chunks."""
    refs: set[str] = set()
    for text in chunks_text:
        for ref in CITATION_RE.findall(text):
            refs.add(ref.lower())
    return refs


def _ensure_disclaimer(text: str) -> str:
    """Ensure the mandatory disclaimer is present and is always the final sentence."""
    # Remove any existing disclaimer variant
    cleaned = re.sub(
        r"⚖️.*?consult a qualified Ghanaian lawyer\.?",
        "",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    ).strip()

    return f"{cleaned}\n\n{MANDATORY_DISCLAIMER}"


def _flag_unverified_citations(
    response: str,
    chunk_refs: set[str],
) -> tuple[str, list[str]]:
    """
    Check cited article/section numbers against what's actually in retrieved chunks.
    Returns (possibly annotated response, list of suspicious citations).
    """
    cited_in_response = _extract_cited_refs(response)
    suspicious = []

    for ref in cited_in_response:
        if ref.lower() not in chunk_refs:
            suspicious.append(ref)

    if suspicious:
        logger.warning(f"Potentially unverified citations: {suspicious}")
        # Append a soft warning — do not silently suppress the response
        note = (
            "\n\n📌 Note: Some references in this response could not be verified "
            "against the retrieved legal text. Please verify these provisions directly "
            "with the relevant Act before relying on them."
        )
        response = response + note

    return response, suspicious


def safety_check(
    response: str,
    cited_articles: Optional[list[str]] = None,
    retrieved_chunk_texts: Optional[list[str]] = None,
) -> str:
    """
    Run the full safety pipeline on a model response:
      1. Build reference set from retrieved chunks
      2. Check cited refs against that set
      3. Inject mandatory disclaimer
    
    Args:
        response: Raw model output text
        cited_articles: List of cited article strings (e.g. ["Labour Act 651, Art. 68"])
        retrieved_chunk_texts: Raw text of the top-k retrieved chunks
    
    Returns:
        Safety-checked response string
    """
    if not response or not response.strip():
        return MANDATORY_DISCLAIMER

    # Build verifiable ref set from chunk texts
    chunk_refs: set[str] = set()
    if retrieved_chunk_texts:
        chunk_refs = _refs_from_chunks(retrieved_chunk_texts)

    # Citation verification (only if we have chunk texts to verify against)
    if chunk_refs:
        response, suspicious = _flag_unverified_citations(response, chunk_refs)
        if suspicious:
            logger.warning(f"Safety: {len(suspicious)} unverified citations flagged")

    # Always inject disclaimer
    response = _ensure_disclaimer(response)

    return response


def is_prompt_injection(user_input: str) -> bool:
    """
    Basic prompt injection detection.
    Detects common attempts to override system instructions.
    """
    injection_patterns = [
        r"ignore\s+(previous|above|all)\s+instructions",
        r"disregard\s+.{0,30}\s+instructions",
        r"you\s+are\s+now\s+(?:a\s+)?(?:different|new|unrestricted)",
        r"act\s+as\s+(?:if\s+you\s+are\s+)?(?:an?\s+)?(?:evil|harmful|unfiltered)",
        r"forget\s+.{0,30}\s+(?:rules|guidelines|instructions)",
        r"jailbreak",
        r"DAN\s+mode",
        r"<\s*script",
        r"javascript:",
    ]

    text_lower = user_input.lower()
    for pattern in injection_patterns:
        if re.search(pattern, text_lower, re.IGNORECASE):
            logger.warning(f"Prompt injection attempt detected: pattern={pattern[:30]}")
            return True
    return False
