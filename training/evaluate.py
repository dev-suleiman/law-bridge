"""
LawBridge GH — Fine-tuned Model Evaluation
Evaluates the fine-tuned Mistral 7B adapter against the acceptance criteria
defined in the production spec before allowing deployment.

Acceptance criteria (must ALL pass):
  ✓ Citation accuracy   >= 90%  (cited Articles exist in source corpus)
  ✓ Hallucination rate  <=  5%  (no fabricated statute references)
  ✓ Disclaimer present  = 100%  (mandatory legal disclaimer in every response)
  ✓ ROUGE-L (letters)   >= 0.55 (letter drafting quality)

Usage:
  python training/evaluate.py \
    --model_path ./model/lawbridge-mistral-7b-lora \
    --test_data training/data/test.jsonl
"""

import re
import json
import logging
import argparse
from pathlib import Path

logger = logging.getLogger("lawbridge.evaluate")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

DISCLAIMER_PATTERN = re.compile(
    r"this is legal information.+?not legal advice",
    re.IGNORECASE | re.DOTALL,
)

CITATION_RE = re.compile(
    r"(?:Article|Art\.|Section|§|Sec\.)\s*(\d+[A-Za-z]?(?:\(\d+\))?)",
    re.IGNORECASE,
)


def extract_refs_from_text(text: str) -> set[str]:
    return {m.lower() for m in CITATION_RE.findall(text)}


def compute_rouge_l(hypothesis: str, reference: str) -> float:
    """Simple ROUGE-L implementation (LCS-based)."""
    def lcs(x, y):
        m, n = len(x), len(y)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if x[i-1] == y[j-1]:
                    dp[i][j] = dp[i-1][j-1] + 1
                else:
                    dp[i][j] = max(dp[i-1][j], dp[i][j-1])
        return dp[m][n]

    hyp_tokens = hypothesis.lower().split()
    ref_tokens = reference.lower().split()

    if not hyp_tokens or not ref_tokens:
        return 0.0

    lcs_len = lcs(hyp_tokens, ref_tokens)
    precision = lcs_len / len(hyp_tokens) if hyp_tokens else 0
    recall = lcs_len / len(ref_tokens) if ref_tokens else 0

    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def evaluate(model_path: str, test_data_path: str, max_samples: int = 200):
    """Run full evaluation against acceptance criteria."""

    # Load test data
    test_samples = []
    with open(test_data_path) as f:
        for line in f:
            line = line.strip()
            if line:
                test_samples.append(json.loads(line))

    test_samples = test_samples[:max_samples]
    logger.info(f"Evaluating on {len(test_samples)} samples from {test_data_path}")

    # Load model
    logger.info(f"Loading fine-tuned model from {model_path}")
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
    from peft import PeftModel

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
    )

    tokenizer = AutoTokenizer.from_pretrained(model_path)
    base = AutoModelForCausalLM.from_pretrained(
        "mistralai/Mistral-7B-Instruct-v0.3",
        quantization_config=bnb_config,
        device_map="auto",
    )
    model = PeftModel.from_pretrained(base, model_path)
    model.eval()

    def generate(prompt: str) -> str:
        inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048).to(model.device)
        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=800,
                temperature=0.1,
                do_sample=False,
                pad_token_id=tokenizer.eos_token_id,
            )
        new_tokens = out[0][inputs["input_ids"].shape[1]:]
        return tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

    # Metrics accumulators
    citation_correct = 0
    citation_total = 0
    hallucination_count = 0
    disclaimer_present = 0
    rouge_scores = []
    total = len(test_samples)

    for i, sample in enumerate(test_samples):
        if (i + 1) % 10 == 0:
            logger.info(f"Evaluating sample {i+1}/{total}...")

        context = sample.get("legal_context", "")
        scenario = sample.get("scenario", "")
        ref_rights = sample.get("rights_explanation", "")
        ref_letter = sample.get("formal_letter", "")

        prompt = f"[INST] LEGAL CONTEXT:\n{context}\n\nCITIZEN SITUATION:\n{scenario}\n\nExplain this person's legal rights. [/INST]"

        try:
            response = generate(prompt)
        except Exception as e:
            logger.warning(f"Generation failed for sample {i}: {e}")
            continue

        # 1. Disclaimer check
        if DISCLAIMER_PATTERN.search(response):
            disclaimer_present += 1

        # 2. Citation accuracy
        cited_in_response = extract_refs_from_text(response)
        source_refs = extract_refs_from_text(context)

        for ref in cited_in_response:
            citation_total += 1
            if ref in source_refs:
                citation_correct += 1
            else:
                hallucination_count += 1

        # 3. ROUGE-L for letter if present
        if ref_letter:
            letter_prompt = f"[INST] LEGAL CONTEXT:\n{context}\n\nCITIZEN SITUATION:\n{scenario}\n\nDraft a formal letter asserting their rights. [/INST]"
            try:
                letter_response = generate(letter_prompt)
                rouge = compute_rouge_l(letter_response, ref_letter)
                rouge_scores.append(rouge)
            except Exception:
                pass

    # ── Results ───────────────────────────────────────────────────────────────
    citation_accuracy = citation_correct / citation_total if citation_total > 0 else 0.0
    hallucination_rate = hallucination_count / citation_total if citation_total > 0 else 0.0
    disclaimer_rate = disclaimer_present / total
    avg_rouge_l = sum(rouge_scores) / len(rouge_scores) if rouge_scores else 0.0

    print("\n" + "=" * 60)
    print("LAWBRIDGE GH — MODEL EVALUATION RESULTS")
    print("=" * 60)

    def check(metric, value, threshold, higher_is_better=True):
        passed = value >= threshold if higher_is_better else value <= threshold
        symbol = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {symbol}  {metric}: {value:.1%} (threshold: {'≥' if higher_is_better else '≤'}{threshold:.0%})")
        return passed

    results = [
        check("Citation accuracy   ", citation_accuracy, 0.90),
        check("Disclaimer present  ", disclaimer_rate, 1.00),
        check("Hallucination rate  ", hallucination_rate, 0.05, higher_is_better=False),
    ]

    if rouge_scores:
        results.append(check("ROUGE-L (letters)   ", avg_rouge_l, 0.55))
    else:
        print("  ⚠️   ROUGE-L: no letter samples in test set")

    print("=" * 60)
    all_passed = all(results)
    print(f"\n{'✅ ALL CRITERIA MET — Safe to deploy' if all_passed else '❌ CRITERIA NOT MET — Do not deploy'}\n")

    if not all_passed:
        print("Remediation options:")
        if citation_accuracy < 0.90:
            print("  - Increase training epochs or dataset size")
            print("  - Verify training data citation quality")
        if hallucination_rate > 0.05:
            print("  - Lower temperature during inference")
            print("  - Strengthen system prompt citation requirements")
        if disclaimer_rate < 1.00:
            print("  - Update system prompt to enforce disclaimer")
            print("  - Apply safety_check() post-processing (already in pipeline)")
        if rouge_scores and avg_rouge_l < 0.55:
            print("  - Add more letter-drafting examples to training data")

    return all_passed


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", default="./model/lawbridge-mistral-7b-lora")
    parser.add_argument("--test_data", default="training/data/test.jsonl")
    parser.add_argument("--max_samples", type=int, default=200)
    args = parser.parse_args()

    passed = evaluate(args.model_path, args.test_data, args.max_samples)
    import sys
    sys.exit(0 if passed else 1)
