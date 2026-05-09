import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text

from app.api import (
    specs, games, modlist, settings, auth, stats, generation,
    compatibility, plugin, nexus_oauth, user,
)
from app.config import get_settings
from app.database import engine, async_session

app_settings = get_settings()

# Logging: level from LOG_LEVEL env var (default INFO).
# When DEBUG, also write to logs/generation.log for later review.
_log_level = getattr(logging, app_settings.log_level.upper(), logging.INFO)
logging.basicConfig(
    level=_log_level,
    format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
if _log_level <= logging.DEBUG:
    import os
    os.makedirs("logs", exist_ok=True)
    _fh = logging.FileHandler("logs/generation.log", encoding="utf-8")
    _fh.setLevel(logging.DEBUG)
    _fh.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    logging.getLogger("app").addHandler(_fh)

logger = logging.getLogger(__name__)

# Track whether DB init succeeded
_db_ready = False


async def init_db():
    """Create tables and seed data if empty."""
    global _db_ready
    from app.models import Game  # noqa: F811 — ensure all models are imported
    import app.models  # noqa: F401 — register all models with Base

    # Log connection info (mask password)
    db_url = str(engine.url)
    masked = db_url.split("@")[-1] if "@" in db_url else db_url
    logger.info(f"Connecting to database: ...@{masked}")

    async with engine.begin() as conn:
        # Test raw connectivity first
        await conn.execute(text("SELECT 1"))
        logger.info("Database connection successful.")

    # Schema is now managed by Alembic migrations (see backend/alembic/).
    # Migrations apply via `alembic upgrade head` — run in the Render pre-deploy
    # hook or manually before lifespan startup. Do NOT call create_all here; it
    # only creates missing tables and silently skips ALTER TABLE operations
    # needed for column additions.

    # Apply idempotent column migrations (runs every startup, safe on fresh DBs too)
    async with engine.begin() as conn:
        from app.seeds.run_seed import _apply_migrations
        await _apply_migrations(conn)
    logger.info("Schema migrations applied.")

    async with async_session() as session:
        result = await session.execute(select(Game).limit(1))
        if result.scalar_one_or_none() is None:
            logger.info("Database empty — running seed...")
            from app.seeds.run_seed import main as run_seed
            await run_seed()
            logger.info("Seed complete.")

    _db_ready = True


async def _run_account_cleanup_loop():
    """Periodically warn and delete inactive accounts."""
    settings = get_settings()
    await asyncio.sleep(60)  # Let the app finish starting up
    while True:
        try:
            from app.services.account_cleanup import run_cleanup_cycle
            await run_cleanup_cycle()
        except Exception:
            logger.exception("Account cleanup cycle failed")
        await asyncio.sleep(settings.account_cleanup_interval_hours * 3600)


async def _run_nexus_token_refresh_loop():
    """Periodically refresh Nexus OAuth tokens before they expire."""
    await asyncio.sleep(30)  # Stagger from other startup tasks
    while True:
        try:
            from app.services.nexus_token_refresh import refresh_expiring_tokens
            await refresh_expiring_tokens()
        except Exception:
            logger.exception("Nexus token refresh cycle failed")
        # Check every 2 minutes; the window itself is 5 min so tokens are refreshed
        # well before they expire even if a cycle fails.
        await asyncio.sleep(120)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
    except Exception:
        logger.exception("Database init failed — app will start without data")

    cleanup_task = asyncio.create_task(_run_account_cleanup_loop())
    nexus_refresh_task = asyncio.create_task(_run_nexus_token_refresh_loop())
    yield
    cleanup_task.cancel()
    nexus_refresh_task.cancel()


app = FastAPI(
    title="ModdersOmni API",
    description="AI-powered video game mod manager API",
    version="0.1.0",
    lifespan=lifespan,
)

# Parse CORS origins and log them
cors_origins = [o.strip() for o in app_settings.cors_origins.split(",") if o.strip()]
logger.info(f"CORS origins: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}"},
    )


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(specs.router, prefix="/api/specs", tags=["specs"])
app.include_router(games.router, prefix="/api/games", tags=["games"])
app.include_router(modlist.router, prefix="/api/modlist", tags=["modlist"])

app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(generation.router, prefix="/api/generation", tags=["generation"])
app.include_router(compatibility.router, prefix="/api/compatibility", tags=["compatibility"])
app.include_router(plugin.router, prefix="/api/plugin", tags=["plugin"])
app.include_router(nexus_oauth.router, prefix="/api/nexus/oauth", tags=["nexus-oauth"])
app.include_router(user.router, prefix="/api/user", tags=["user"])


@app.get("/api/health")
async def health_check():
    db_status = "unknown"
    if _db_ready:
        try:
            async with async_session() as session:
                await session.execute(text("SELECT 1"))
            db_status = "connected"
        except Exception as e:
            db_status = f"error: {type(e).__name__}"
    else:
        db_status = "init_failed"

    return {
        "status": "ok",
        "app": app_settings.app_name,
        "db_ready": _db_ready,
        "db_status": db_status,
    }
