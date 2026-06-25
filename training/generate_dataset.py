"""
LawBridge GH — Training Dataset Generator
Uses Claude API to generate high-quality Ghanaian legal Q&A pairs
from statute source text.

Usage:
  python training/generate_dataset.py \
    --corpus_dir training/source_docs/ \
    --output_dir training/data/ \
    --n_samples 10000 \
    --anthropic_key sk-ant-...

Source documents go in training/source_docs/ as text files (.txt or .pdf).
Name them by act: "labour_act_651.txt", "rent_act_220.txt", etc.

Output: training/data/train.jsonl, val.jsonl, test.jsonl (90/5/5 split)
"""

import os
import sys
import json
import random
import logging
import asyncio
import argparse
from pathlib import Path
from typing import Optional

import anthropic

logger = logging.getLogger("lawbridge.dataset")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

ACTS = {
    "labour_act_651": "Labour Act 651 (2003)",
    "rent_act_220": "Rent Act 220 (1963)",
    "constitution_1992": "1992 Constitution of Ghana",
    "criminal_offences_act_29": "Criminal Offences Act 29 (1960)",
    "consumer_protection_act_890": "Consumer Protection Act 890 (2020)",
    "domestic_violence_act_732": "Domestic Violence Act 732 (2007)",
    "childrens_act_560": "Children's Act 560 (1998)",
}

GENERATION_PROMPT = """\
You are generating a training dataset for an AI legal assistant focused on Ghanaian law.

Given this excerpt from {act_name}, generate {n} realistic training examples.

STATUTE EXCERPT:
{excerpt}

For each example, create a JSON object with:
- "scenario": A realistic situation a Ghanaian citizen might face (1-3 sentences, plain language, first or third person)
- "legal_context": The most relevant 2-4 sentences from the statute above that apply to this scenario
- "rights_explanation": A clear, plain-language explanation of the person's rights (3-6 sentences). Must cite the specific Article/Section number. Must end with: "⚖️ This is legal information, not legal advice. For your specific situation, consult a qualified Ghanaian lawyer."
- "formal_letter": A ready-to-send formal letter asserting the person's rights. Use placeholders: [YOUR FULL NAME], [YOUR ADDRESS], [DATE], [RECIPIENT NAME], [RECIPIENT ADDRESS]. Sign off: [YOUR FULL NAME].

Output ONLY a valid JSON array — no markdown, no preamble, no explanation.
Example structure:
[
  {{"scenario": "...", "legal_context": "...", "rights_explanation": "...", "formal_letter": "..."}}
]

Vary the scenarios: include different regions of Ghana, different demographics (students, market traders, domestic workers, civil servants), different severity levels."""


def extract_text_chunks(file_path: Path, chunk_size: int = 2000) -> list[str]:
    """Extract overlapping text chunks from a source document."""
    if file_path.suffix == ".pdf":
        import fitz
        doc = fitz.open(str(file_path))
        text = "\n".join(page.get_text() for page in doc)
    else:
        text = file_path.read_text(encoding="utf-8", errors="replace")

    chunks = []
    step = chunk_size - 200  # 200-char overlap
    for i in range(0, len(text), step):
        chunk = text[i:i + chunk_size].strip()
        if len(chunk) > 500:  # Skip tiny chunks
            chunks.append(chunk)
    return chunks


async def generate_examples_for_chunk(
    client: anthropic.AsyncAnthropic,
    excerpt: str,
    act_name: str,
    n: int = 3,
) -> list[dict]:
    """Generate n Q&A examples for a single statute excerpt."""
    try:
        msg = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": GENERATION_PROMPT.format(
                    act_name=act_name,
                    excerpt=excerpt,
                    n=n,
                ),
            }],
        )
        text = msg.content[0].text.strip()

        # Strip markdown code blocks if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        examples = json.loads(text)
        if not isinstance(examples, list):
            examples = [examples]

        # Validate required fields
        valid = []
        for ex in examples:
            if all(k in ex for k in ("scenario", "legal_context", "rights_explanation")):
                valid.append(ex)
        return valid

    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"Generation failed for chunk ({act_name}): {e}")
        return []


def verify_citations(examples: list[dict], source_text: str) -> list[dict]:
    """
    Consistency checker: verifies that cited Article/Section numbers
    actually appear in the source document text.
    """
    import re
    citation_re = re.compile(r"(?:Article|Section|Art\.|§)\s*(\d+[A-Za-z]?)", re.IGNORECASE)

    verified = []
    for ex in examples:
        rights = ex.get("rights_explanation", "")
        cited_nums = citation_re.findall(rights)
        all_ok = True
        for num in cited_nums:
            # Check if this number appears in source text
            if not re.search(rf"(?:Article|Section)\s*{re.escape(num)}\b", source_text, re.IGNORECASE):
                all_ok = False
                logger.debug(f"Citation Art.{num} not found in source — flagging")
                break
        if all_ok or not cited_nums:
            verified.append(ex)
        else:
            logger.debug("Dropped example with unverifiable citation")
    return verified


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus_dir", default="training/source_docs")
    parser.add_argument("--output_dir", default="training/data")
    parser.add_argument("--n_samples", type=int, default=10000)
    parser.add_argument("--examples_per_chunk", type=int, default=3)
    parser.add_argument("--anthropic_key", default=os.environ.get("ANTHROPIC_API_KEY", ""))
    args = parser.parse_args()

    if not args.anthropic_key:
        print("ERROR: Set ANTHROPIC_API_KEY environment variable or pass --anthropic_key")
        sys.exit(1)

    corpus_dir = Path(args.corpus_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not corpus_dir.exists():
        print(f"ERROR: Corpus directory not found: {corpus_dir}")
        print("Create the directory and add Ghana statute text files (.txt or .pdf)")
        sys.exit(1)

    client = anthropic.AsyncAnthropic(api_key=args.anthropic_key)
    all_examples: list[dict] = []

    for file_path in sorted(corpus_dir.glob("*")):
        if file_path.suffix not in (".txt", ".pdf"):
            continue

        stem = file_path.stem
        act_name = ACTS.get(stem, stem.replace("_", " ").title())
        logger.info(f"Processing: {act_name}")

        try:
            chunks = extract_text_chunks(file_path)
            source_text = file_path.read_text(errors="replace") if file_path.suffix == ".txt" else ""
        except Exception as e:
            logger.warning(f"Failed to read {file_path}: {e}")
            continue

        # Process chunks with concurrency limit
        semaphore = asyncio.Semaphore(3)  # max 3 concurrent API calls
        file_examples: list[dict] = []

        async def process_chunk(chunk):
            async with semaphore:
                examples = await generate_examples_for_chunk(
                    client, chunk, act_name, args.examples_per_chunk
                )
                if source_text:
                    examples = verify_citations(examples, source_text)
                return examples

        tasks = [process_chunk(chunk) for chunk in chunks]
        results = await asyncio.gather(*tasks)

        for batch in results:
            file_examples.extend(batch)

        logger.info(f"  Generated {len(file_examples)} examples from {act_name}")
        all_examples.extend(file_examples)

        if len(all_examples) >= args.n_samples:
            break

    # Shuffle and split
    random.shuffle(all_examples)
    all_examples = all_examples[:args.n_samples]

    n = len(all_examples)
    n_train = int(n * 0.90)
    n_val = int(n * 0.05)

    splits = {
        "train": all_examples[:n_train],
        "val": all_examples[n_train:n_train + n_val],
        "test": all_examples[n_train + n_val:],
    }

    for split_name, examples in splits.items():
        out_path = output_dir / f"{split_name}.jsonl"
        with open(out_path, "w") as f:
            for ex in examples:
                f.write(json.dumps(ex, ensure_ascii=False) + "\n")
        logger.info(f"Saved {len(examples)} examples → {out_path}")

    logger.info(f"\nDataset generation complete: {n} total examples")
    logger.info("Next: Run `python training/train.py` to start fine-tuning")


if __name__ == "__main__":
    asyncio.run(main())
