import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.modlist import Modlist, ModlistEntry, ModlistKnowledgeFlag
from app.models.user import User
from app.models.user_settings import UserSettings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    x_confirm_delete: str = Header(..., alias="X-Confirm-Delete"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Permanently delete the authenticated user's account.

    Requires the `X-Confirm-Delete: DELETE` header as an anti-accident guard.
    Cascades through modlists and their children (entries, knowledge flags),
    then user_settings, then the user row. The ORM handles
    cascade="all, delete-orphan" on settings/refresh_tokens/oauth_providers/
    plugin_tokens; the DB-level ON DELETE CASCADE handles
    email_verification_tokens and user_nexus_tokens. Modlists use
    ondelete=SET NULL for the anonymous-carryover case, so we clean them up
    manually here.
    """
    if x_confirm_delete != "DELETE":
        raise HTTPException(
            status_code=400,
            detail="Invalid X-Confirm-Delete header value.",
        )

    modlist_ids_result = await db.execute(
        select(Modlist.id).where(Modlist.user_id == current_user.id)
    )
    modlist_ids = list(modlist_ids_result.scalars().all())

    if modlist_ids:
        await db.execute(
            delete(ModlistEntry).where(ModlistEntry.modlist_id.in_(modlist_ids))
        )
        await db.execute(
            delete(ModlistKnowledgeFlag).where(
                ModlistKnowledgeFlag.modlist_id.in_(modlist_ids)
            )
        )
        await db.execute(
            delete(Modlist).where(Modlist.id.in_(modlist_ids))
        )

    await db.execute(
        delete(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    await db.execute(delete(User).where(User.id == current_user.id))
    await db.commit()

    logger.info("User %s deleted their account", current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
