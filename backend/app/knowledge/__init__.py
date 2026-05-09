"""Game modding methodology knowledge base.

Provides phase-targeted methodology context for the modlist generation pipeline.
Each game has its own markdown file (skyrim.md, fallout4.md) containing structured
sections that are injected into LLM prompts during the relevant build phases.

Usage:
    from app.knowledge import get_methodology_context

    context = get_methodology_context("skyrimse", phase_number=1)
"""

from app.knowledge.resolver import get_methodology_context

__all__ = ["get_methodology_context"]
