"""Training configuration for Gemma 4 fine-tuning."""

from pydantic import BaseModel


class TrainingConfig(BaseModel):
    """Configuration for LoRA fine-tuning of Gemma 4."""

    base_model: str = "google/gemma-4-26b"
    output_dir: str = "./training_output"
    lora_rank: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    learning_rate: float = 2e-5
    num_epochs: int = 3
    batch_size: int = 4
    max_seq_length: int = 8192
    gradient_accumulation_steps: int = 4
    warmup_ratio: float = 0.1
    weight_decay: float = 0.01
