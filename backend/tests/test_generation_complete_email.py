"""Tests for send_generation_complete_email dispatch."""

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_sends_success_email_when_opted_in(test_user_opted_in, test_modlist):
    with patch(
        "app.services.email.generation_complete._smtp_send", new=AsyncMock()
    ) as mock_send:
        from app.services.email.generation_complete import send_generation_complete_email

        await send_generation_complete_email(
            user=test_user_opted_in,
            modlist=test_modlist,
            outcome="success",
        )
        mock_send.assert_awaited_once()
        kwargs = mock_send.await_args.kwargs
        assert "Your Skyrim Special Edition modlist is ready" in kwargs["subject"]
        assert kwargs["to"] == test_user_opted_in.email


@pytest.mark.asyncio
async def test_skips_email_when_opted_out(test_user_opted_out, test_modlist):
    with patch(
        "app.services.email.generation_complete._smtp_send", new=AsyncMock()
    ) as mock_send:
        from app.services.email.generation_complete import send_generation_complete_email

        await send_generation_complete_email(
            user=test_user_opted_out,
            modlist=test_modlist,
            outcome="success",
        )
        mock_send.assert_not_awaited()


@pytest.mark.asyncio
async def test_sends_failure_email(test_user_opted_in, test_modlist):
    with patch(
        "app.services.email.generation_complete._smtp_send", new=AsyncMock()
    ) as mock_send:
        from app.services.email.generation_complete import send_generation_complete_email

        await send_generation_complete_email(
            user=test_user_opted_in,
            modlist=test_modlist,
            outcome="failure",
            error_message="LLM provider rate limited",
        )
        mock_send.assert_awaited_once()
        assert "ran into a problem" in mock_send.await_args.kwargs["subject"]
