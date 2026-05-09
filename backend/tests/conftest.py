import asyncio
import uuid
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_current_user
from app.database import Base, get_db
from app.main import app
from app.models.modlist import Modlist, ModlistEntry
from app.models.user import User


TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ──────────────────────────────────────────────
# Fixtures for /size-summary tests (Block B, Task 14+)
# ──────────────────────────────────────────────

GB = 1024 ** 3


async def _make_user(db: AsyncSession, *, storage_drives: str | None) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"size-{uuid.uuid4().hex[:8]}@example.com",
        password_hash="x",
        display_name="Size Test",
        email_verified=True,
        storage_drives=storage_drives,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _make_modlist(
    db: AsyncSession, user: User, sizes_bytes: list[int | None],
) -> Modlist:
    modlist = Modlist(game_id=1, user_id=user.id)
    db.add(modlist)
    await db.flush()
    for i, size in enumerate(sizes_bytes):
        db.add(ModlistEntry(
            modlist_id=modlist.id,
            name=f"Mod {i + 1}",
            load_order=i + 1,
            file_size_bytes=size,
        ))
    await db.commit()
    await db.refresh(modlist)
    return modlist


@pytest_asyncio.fixture
async def authed_client(db_session):
    """HTTP client with get_current_user dep overridden to return a seeded user
    whose storage_drives = 'C: 500GB free / 931GB'."""
    user = await _make_user(db_session, storage_drives="C: 500GB free / 931GB")

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        ac.current_user = user  # convenience for fixtures that need the same user
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded_modlist(authed_client, db_session):
    """3 entries summing to 10 GB download."""
    user = authed_client.current_user
    return await _make_modlist(
        db_session, user,
        sizes_bytes=[4 * GB, 3 * GB, 3 * GB],
    )


@pytest_asyncio.fixture
async def seeded_modlist_huge(authed_client, db_session):
    """Installed estimate (2.5x) exceeds the 500GB free drive."""
    user = authed_client.current_user
    # 300 GB download * 2.5 = 750 GB installed > 500 GB free → insufficient
    return await _make_modlist(
        db_session, user,
        sizes_bytes=[100 * GB, 100 * GB, 100 * GB],
    )


@pytest_asyncio.fixture
async def seeded_modlist_partial(authed_client, db_session):
    """Mix of sized and NULL-size entries."""
    user = authed_client.current_user
    return await _make_modlist(
        db_session, user,
        sizes_bytes=[2 * GB, None, 3 * GB, None],
    )


@pytest_asyncio.fixture
async def seeded_modlist_no_drives(db_session):
    """User has NULL storage_drives → fit_status must be 'unknown'."""
    user = await _make_user(db_session, storage_drives=None)
    modlist = await _make_modlist(
        db_session, user,
        sizes_bytes=[1 * GB, 2 * GB],
    )

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: user
    return modlist


# ──────────────────────────────────────────────
# Fixtures for generation-complete email tests (Block B, Task 20+)
# MagicMock-based — the email dispatcher takes plain objects and never
# touches the DB, so real ORM rows would be overkill here.
# ──────────────────────────────────────────────


@pytest.fixture
def test_user_opted_in():
    user = MagicMock()
    user.id = uuid.uuid4()
    user.email = "optin@example.com"
    user.display_name = "OptedIn"
    user.settings = MagicMock()
    user.settings.notification_prefs = {"email_on_generation_complete": True}
    return user


@pytest.fixture
def test_user_opted_out():
    user = MagicMock()
    user.id = uuid.uuid4()
    user.email = "optout@example.com"
    user.display_name = "OptedOut"
    user.settings = MagicMock()
    user.settings.notification_prefs = {"email_on_generation_complete": False}
    return user


@pytest.fixture
def test_modlist():
    modlist = MagicMock()
    modlist.id = uuid.uuid4()
    modlist.game = MagicMock()
    modlist.game.name = "Skyrim Special Edition"
    # 40 entries × 5 GB = 200 GB total
    modlist.entries = [
        MagicMock(file_size_bytes=5 * 1024 ** 3) for _ in range(40)
    ]
    return modlist
