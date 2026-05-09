"""Agentic modlist generation pipeline.

Public API re-exports for backward compatibility.

Re-exports for `pipeline` and `session` are lazy via module-level
`__getattr__` so that `app.schemas.modlist` can import `SizePreset`
from `.preset` without triggering a circular import through
`pipeline` → `schemas.modlist`.
"""

from .exceptions import (
    NexusExhaustedError,
    NexusRateLimitError,
    NexusServerError,
    PauseGeneration,
)
from .version import TIER_MIN_VRAM, is_version_compatible

__all__ = [
    "generate_modlist",
    "build_rag_context",
    "GenerationResult",
    "GenerationSession",
    "PauseGeneration",
    "NexusRateLimitError",
    "NexusServerError",
    "NexusExhaustedError",
    "is_version_compatible",
    "TIER_MIN_VRAM",
]


_LAZY_PIPELINE = {"generate_modlist", "build_rag_context"}
_LAZY_SESSION = {"GenerationResult", "GenerationSession"}


def __getattr__(name: str):
    if name in _LAZY_PIPELINE:
        from . import pipeline
        return getattr(pipeline, name)
    if name in _LAZY_SESSION:
        from . import session
        return getattr(session, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
