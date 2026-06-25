"""
LawBridge GH — LoRA Fine-Tuning Script
Trains Mistral 7B Instruct v0.3 on Ghanaian legal Q&A pairs using QLoRA.

Prerequisites:
  - Python 3.11+ with GPU environment (KNUST GPU, Colab Pro+, or Kaggle)
  - At least 16GB VRAM (or 24GB recommended) for QLoRA 4-bit training
  - HuggingFace account with Mistral 7B access granted
  - Training dataset at training/data/train.jsonl (see generate_dataset.py)

Usage:
  python training/train.py --config training/config.yaml
  python training/train.py --resume_from_checkpoint ./checkpoints/checkpoint-500

After training:
  - Adapter weights saved to ./model/lawbridge-mistral-7b-lora/
  - Upload to Supabase Storage for Railway deployment
  - Set MODEL_MODE=mistral in Railway environment
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from typing import Optional

logger = logging.getLogger("lawbridge.training")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def parse_args():
    parser = argparse.ArgumentParser(description="LawBridge GH LoRA Fine-tuning")
    parser.add_argument("--config", default="training/config.yaml")
    parser.add_argument("--resume_from_checkpoint", type=str, default=None)
    parser.add_argument("--output_dir", default="./model/lawbridge-mistral-7b-lora")
    parser.add_argument("--data_dir", default="./training/data")
    parser.add_argument("--hf_token", default=os.environ.get("HF_TOKEN", ""))
    parser.add_argument("--dry_run", action="store_true", help="Validate setup without training")
    return parser.parse_args()


def load_dataset(data_dir: str):
    """Load JSONL training data."""
    from datasets import Dataset
    import json

    train_path = Path(data_dir) / "train.jsonl"
    val_path = Path(data_dir) / "val.jsonl"

    if not train_path.exists():
        raise FileNotFoundError(
            f"Training data not found at {train_path}. "
            "Run `python training/generate_dataset.py` first."
        )

    def load_jsonl(path):
        records = []
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
        return records

    train_records = load_jsonl(train_path)
    val_records = load_jsonl(val_path) if val_path.exists() else train_records[:int(len(train_records) * 0.05)]

    logger.info(f"Loaded {len(train_records)} training samples, {len(val_records)} validation samples")
    return Dataset.from_list(train_records), Dataset.from_list(val_records)


def format_prompt(record: dict) -> str:
    """
    Format a training record into Mistral instruction format.
    
    Expected record fields:
      scenario: str         — citizen's situation in plain English
      legal_context: str    — relevant statute excerpt
      rights_explanation: str — plain-language rights explanation
      formal_letter: str    — ready-to-send letter (optional)
    """
    scenario = record.get("scenario", "")
    legal_context = record.get("legal_context", "")
    rights = record.get("rights_explanation", "")
    letter = record.get("formal_letter", "")

    user_prompt = f"""LEGAL CONTEXT (Ghana's statutes):
{legal_context}

CITIZEN'S SITUATION:
{scenario}

Explain this person's legal rights clearly, citing the relevant Acts and Articles."""

    response = rights
    if letter:
        response += f"\n\n---FORMAL LETTER---\n{letter}"

    # Mistral instruction format
    return f"[INST] {user_prompt} [/INST] {response}</s>"


def tokenize_dataset(dataset, tokenizer, max_length: int = 2048):
    """Tokenize and format the dataset."""

    def tokenize(batch):
        texts = [format_prompt(r) for r in batch["scenario"] if isinstance(r, str)]
        # Re-format full records
        full_texts = []
        for i in range(len(batch[list(batch.keys())[0]])):
            record = {k: batch[k][i] for k in batch.keys()}
            full_texts.append(format_prompt(record))

        encodings = tokenizer(
            full_texts,
            truncation=True,
            max_length=max_length,
            padding="max_length",
            return_tensors=None,
        )
        encodings["labels"] = encodings["input_ids"].copy()
        return encodings

    return dataset.map(tokenize, batched=True, remove_columns=dataset.column_names)


def main():
    args = parse_args()

    # ── Imports (GPU-only libraries) ──────────────────────────────────────────
    try:
        import torch
        from transformers import (
            AutoTokenizer,
            AutoModelForCausalLM,
            TrainingArguments,
            Trainer,
            DataCollatorForLanguageModeling,
            BitsAndBytesConfig,
            EarlyStoppingCallback,
        )
        from peft import (
            LoraConfig,
            get_peft_model,
            prepare_model_for_kbit_training,
            TaskType,
        )
    except ImportError as e:
        logger.error(f"Missing dependency: {e}. Install training requirements: pip install -r training/requirements-training.txt")
        sys.exit(1)

    # ── GPU check ─────────────────────────────────────────────────────────────
    if not torch.cuda.is_available():
        logger.warning("No CUDA GPU detected! Training on CPU will be extremely slow.")
        logger.warning("Use KNUST GPU, Google Colab Pro+, or Kaggle GPU for training.")
        if not args.dry_run:
            response = input("Continue anyway? (y/N): ")
            if response.lower() != "y":
                sys.exit(0)
    else:
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
        logger.info(f"GPU: {gpu_name} | VRAM: {vram_gb:.1f} GB")

    # ── Load tokenizer ────────────────────────────────────────────────────────
    BASE_MODEL = "mistralai/Mistral-7B-Instruct-v0.3"
    logger.info(f"Loading tokenizer from {BASE_MODEL}")
    tokenizer = AutoTokenizer.from_pretrained(
        BASE_MODEL,
        token=args.hf_token or None,
        trust_remote_code=True,
    )
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # ── Load dataset ──────────────────────────────────────────────────────────
    train_ds, val_ds = load_dataset(args.data_dir)

    if args.dry_run:
        logger.info("Dry run complete — dataset and tokenizer loaded successfully")
        logger.info(f"Train samples: {len(train_ds)}, Val samples: {len(val_ds)}")
        sample = train_ds[0]
        prompt = format_prompt(sample)
        logger.info(f"Sample prompt (first 500 chars):\n{prompt[:500]}")
        return

    # ── QLoRA config ──────────────────────────────────────────────────────────
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
    )

    logger.info("Loading Mistral 7B base model with 4-bit quantisation...")
    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        token=args.hf_token or None,
    )

    model = prepare_model_for_kbit_training(model)

    # ── LoRA adapter config ───────────────────────────────────────────────────
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,                     # LoRA rank — higher = more params, better fit
        lora_alpha=32,            # scaling factor
        lora_dropout=0.05,
        bias="none",
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
        # Also train gate/up/down projections for better instruction following:
        # target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )

    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # ── Tokenize datasets ─────────────────────────────────────────────────────
    logger.info("Tokenizing datasets...")
    train_tokenized = tokenize_dataset(train_ds, tokenizer)
    val_tokenized = tokenize_dataset(val_ds, tokenizer)

    # ── Training arguments ────────────────────────────────────────────────────
    output_dir = args.output_dir
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=3,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        gradient_accumulation_steps=4,       # effective batch size = 16
        gradient_checkpointing=True,         # reduce VRAM usage
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        weight_decay=0.01,
        fp16=True,                           # mixed precision training
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=100,
        save_strategy="steps",
        save_steps=200,
        save_total_limit=3,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        report_to=["tensorboard"],
        logging_dir=f"{output_dir}/logs",
        dataloader_num_workers=2,
        remove_unused_columns=False,
        optim="paged_adamw_8bit",           # memory-efficient optimiser
    )

    # ── Trainer ───────────────────────────────────────────────────────────────
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_tokenized,
        eval_dataset=val_tokenized,
        data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3)],
    )

    # ── Train ─────────────────────────────────────────────────────────────────
    logger.info("Starting training...")
    trainer.train(resume_from_checkpoint=args.resume_from_checkpoint)

    # ── Save adapter ──────────────────────────────────────────────────────────
    logger.info(f"Saving LoRA adapter to {output_dir}")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)

    logger.info("=" * 60)
    logger.info("Training complete!")
    logger.info(f"Adapter saved to: {output_dir}")
    logger.info("Next steps:")
    logger.info("  1. Run evaluation: python training/evaluate.py")
    logger.info("  2. If evaluation passes, upload adapter to Supabase Storage")
    logger.info("  3. Set MODEL_MODE=mistral in Railway environment")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
