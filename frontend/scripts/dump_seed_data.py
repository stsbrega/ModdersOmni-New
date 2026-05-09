"""
One-shot seed extractor.

Run via:
    python frontend/scripts/dump_seed_data.py

Prints JSON to stdout. The Node wrapper at extract-seed-data.ts captures
this output and writes the per-table JSON files under public/data/.

This script is one-shot — re-run only matters if backend/app/seeds/seed_data.py
changes before the backend is deleted (Plan 3).
"""
import json
import os
import sys

# Make backend/ importable. This file lives at frontend/scripts/dump_seed_data.py;
# the repo root is two levels up.
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "backend"))

from app.seeds import seed_data  # noqa: E402

out = {
    "games": seed_data.GAMES,
    "playstyles": seed_data.PLAYSTYLES,
    "build_phases_skyrim": seed_data.SKYRIM_BUILD_PHASES,
    "build_phases_fallout4": seed_data.FALLOUT4_BUILD_PHASES,
    "compatibility_skyrim": seed_data.SKYRIM_COMPATIBILITY,
    "compatibility_fallout4": seed_data.FALLOUT4_COMPATIBILITY,
}

print(json.dumps(out, default=str))
