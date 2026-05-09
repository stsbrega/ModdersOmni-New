"""Send a completion email when a generation ends (success or failure)."""

import logging
from typing import Literal

from app.models.modlist import Modlist
from app.models.user import User
from app.services.email import get_email_sender

logger = logging.getLogger(__name__)


async def _smtp_send(*, to: str, subject: str, html: str) -> None:
    """Thin seam over the configured EmailSender — patched in tests."""
    sender = get_email_sender()
    await sender.send_email(to=to, subject=subject, html_body=html)


async def send_generation_complete_email(
    *,
    user: User,
    modlist: Modlist,
    outcome: Literal["success", "failure"],
    error_message: str | None = None,
) -> None:
    """Dispatch a generation-complete email if the user is opted in."""
    prefs = (user.settings.notification_prefs or {}) if user.settings else {}
    if not prefs.get("email_on_generation_complete", True):
        logger.info("User %s opted out of completion emails — skipping.", user.id)
        return

    game_name = modlist.game.name if getattr(modlist, "game", None) else "modlist"
    mod_count = len(modlist.entries) if modlist.entries else 0
    total_gb = sum((e.file_size_bytes or 0) for e in modlist.entries) / 1024**3

    if outcome == "success":
        subject = f"Your {game_name} modlist is ready"
        html = (
            f"<p>Hey {user.display_name or 'there'},</p>"
            f"<p>Your <strong>{game_name}</strong> modlist just finished generating — "
            f"<strong>{mod_count} mods, {total_gb:.1f} GB download</strong>.</p>"
            f'<p><a href="https://moddersomni.com/modlist/{modlist.id}">Open the modlist</a></p>'
            f"<p>— ModdersOmni</p>"
        )
    else:
        subject = f"Your {game_name} modlist generation ran into a problem"
        detail = f"<br><small>{error_message}</small>" if error_message else ""
        html = (
            f"<p>Hey {user.display_name or 'there'},</p>"
            f"<p>Your <strong>{game_name}</strong> modlist generation didn't "
            f"complete successfully.{detail}</p>"
            f'<p><a href="https://moddersomni.com/dashboard">Retry from your dashboard</a></p>'
            f"<p>— ModdersOmni</p>"
        )

    await _smtp_send(to=user.email, subject=subject, html=html)
