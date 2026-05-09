"""Export modding knowledge and modlist data as JSONL for fine-tuning.

Usage: python -m app.training.export_data [--output-dir ./training_data]
"""

import asyncio
import argparse
import json
import logging
import os
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

_KNOWLEDGE_DIR = Path(__file__).parent.parent / "knowledge"


def export_knowledge_base(output_path: str) -> int:
    """Export knowledge base markdown files as JSONL training conversations."""
    count = 0
    dirname = os.path.dirname(output_path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        for md_file in _KNOWLEDGE_DIR.glob("*.md"):
            content = md_file.read_text(encoding="utf-8")
            sections = content.split("\n## ")
            for section in sections:
                if not section.strip():
                    continue
                lines = section.strip().split("\n", 1)
                title = lines[0].strip("# ").strip()
                body = lines[1].strip() if len(lines) > 1 else ""
                if len(body) < 50:
                    continue

                conversation = {
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are an expert video game modding "
                                "assistant."
                            ),
                        },
                        {
                            "role": "user",
                            "content": f"Explain {title} for modding.",
                        },
                        {"role": "assistant", "content": body},
                    ],
                }
                f.write(json.dumps(conversation) + "\n")
                count += 1

    logger.info("Exported %d knowledge base entries to %s", count, output_path)
    return count


async def export_modlists(output_path: str) -> int:
    """Export successful modlist generations as JSONL training data."""
    from app.database import async_session
    from app.models.modlist import Modlist

    count = 0
    dirname = os.path.dirname(output_path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)

    async with async_session() as db:
        result = await db.execute(
            select(Modlist).options(selectinload(Modlist.entries)).limit(500),
        )
        modlists = result.scalars().all()

        with open(output_path, "w", encoding="utf-8") as f:
            for ml in modlists:
                if not ml.entries:
                    continue
                mods_text = "\n".join(
                    f"- {e.name}: {e.reason or 'recommended'}"
                    for e in ml.entries
                    if not e.is_patch
                )
                patches_text = "\n".join(
                    f"- {e.name}: {e.reason or 'compatibility patch'}"
                    for e in ml.entries
                    if e.is_patch
                )

                conversation = {
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are an expert video game modding "
                                "assistant."
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                f"Create a mod list for game ID "
                                f"{ml.game_id}"
                                + (f" with playstyle ID {ml.playstyle_id}" if ml.playstyle_id else "")
                                + "."
                            ),
                        },
                        {
                            "role": "assistant",
                            "content": (
                                f"Here are the recommended mods:\n\n"
                                f"{mods_text}\n\n"
                                f"Compatibility patches:\n{patches_text}"
                            ),
                        },
                    ],
                }
                f.write(json.dumps(conversation) + "\n")
                count += 1

    logger.info("Exported %d modlists to %s", count, output_path)
    return count


async def export_all(output_dir: str) -> dict:
    """Run all exports and return summary statistics."""
    os.makedirs(output_dir, exist_ok=True)

    kb_count = export_knowledge_base(
        os.path.join(output_dir, "knowledge_base.jsonl"),
    )
    ml_count = await export_modlists(
        os.path.join(output_dir, "modlists.jsonl"),
    )

    stats = {
        "knowledge_base_entries": kb_count,
        "modlist_entries": ml_count,
        "output_dir": output_dir,
    }
    with open(os.path.join(output_dir, "export_stats.json"), "w") as f:
        json.dump(stats, f, indent=2)

    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Export training data for Gemma 4 fine-tuning",
    )
    parser.add_argument(
        "--output-dir", default="./training_data", help="Output directory",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    asyncio.run(export_all(args.output_dir))
