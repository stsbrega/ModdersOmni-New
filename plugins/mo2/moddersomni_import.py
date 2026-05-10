"""
ModdersOmni MO2 Import Plugin (v2)

Imports a modlist JSON exported from ModdersOmni v2.0+ and queues each
mod for installation through MO2's existing Nexus Mods integration.

v1 of this plugin used a backend HTTP API + per-user plugin token to
fetch modlists; v2 has no backend, so this plugin reads a local JSON
file the user downloads from the ModdersOmni web app.

JSON schema (matches frontend/src/app/core/services/install-guide.service.ts):
    {
        "version": "2.0.0",
        "game": "skyrim" | "fallout4",
        "name": "<modlist name>",
        "mods": [
            {
                "modId": <int>,
                "fileId": <int>,
                "name": "<display name>",
                "installOrder": <int>,
                "notes": "<optional install notes>"
            },
            ...
        ]
    }
"""
import json
import os
from typing import List

from PyQt6.QtCore import QCoreApplication
from PyQt6.QtWidgets import QFileDialog, QMessageBox

import mobase


class ModdersOmniImportPlugin(mobase.IPluginTool):
    NAME = "ModdersOmni Import"
    AUTHOR = "ModdersOmni"
    VERSION = "2.0.0"

    def __init__(self):
        super().__init__()
        self._organizer: mobase.IOrganizer | None = None

    # ── IPlugin metadata ──
    def init(self, organizer: mobase.IOrganizer) -> bool:
        self._organizer = organizer
        return True

    def name(self) -> str:                     return self.NAME
    def author(self) -> str:                   return self.AUTHOR
    def description(self) -> str:              return "Import a modlist JSON exported from the ModdersOmni web app."
    def version(self) -> mobase.VersionInfo:   return mobase.VersionInfo(2, 0, 0, 0)
    def isActive(self) -> bool:                return True
    def settings(self) -> List[mobase.PluginSetting]: return []
    def displayName(self) -> str:              return "ModdersOmni Import"
    def tooltip(self) -> str:                  return self.description()
    def icon(self):                            return None

    # ── IPluginTool ──
    def display(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            None,
            "Select ModdersOmni modlist JSON",
            os.path.expanduser("~"),
            "ModdersOmni Modlist (*.json)",
        )
        if not path:
            return

        try:
            with open(path, "r", encoding="utf-8") as f:
                payload = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            QMessageBox.critical(None, "Import failed", f"Could not read {path}:\n{e}")
            return

        if not self._validate(payload):
            return

        mods = payload.get("mods", [])
        QMessageBox.information(
            None,
            "Import starting",
            f"Queueing {len(mods)} mods for {payload.get('game', '?')}.\n\n"
            "Each mod will be downloaded via MO2's Nexus integration "
            "in install_order. Download speeds depend on your Nexus account "
            "(premium accounts get higher concurrent download limits).",
        )

        nexus = self._organizer.downloadManager()
        game_domain = self._game_domain(payload["game"])
        queued = 0
        skipped = 0

        for mod in sorted(mods, key=lambda m: m.get("installOrder", 0)):
            mod_id = mod.get("modId")
            file_id = mod.get("fileId")
            name = mod.get("name", f"mod-{mod_id}")
            if not mod_id or not file_id:
                skipped += 1
                continue
            try:
                nexus.startDownloadNexusFile(mod_id, file_id)
                queued += 1
            except Exception as e:  # MO2 throws on permissions / network failures
                skipped += 1

        QMessageBox.information(
            None,
            "Import complete",
            f"Queued: {queued}\nSkipped: {skipped}\n\n"
            "Watch the Downloads tab for progress. Install each mod in order "
            "after it finishes downloading.",
        )

    # ── Helpers ──
    def _validate(self, payload: dict) -> bool:
        if not isinstance(payload, dict):
            QMessageBox.critical(None, "Invalid file", "JSON root is not an object.")
            return False
        if not isinstance(payload.get("mods"), list):
            QMessageBox.critical(None, "Invalid file", "Missing 'mods' array.")
            return False
        if payload.get("game") not in ("skyrim", "skyrimse", "fallout4"):
            QMessageBox.critical(
                None, "Invalid file",
                f"Unknown game: {payload.get('game')}. Expected 'skyrim' or 'fallout4'.",
            )
            return False
        # Loose version check — accept v2.x.x payloads
        version = str(payload.get("version", "0"))
        if not version.startswith("2."):
            reply = QMessageBox.question(
                None, "Version mismatch",
                f"This file says it's from ModdersOmni v{version}, but this plugin expects v2.x.\n"
                "Try anyway?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            )
            if reply != QMessageBox.StandardButton.Yes:
                return False
        return True

    def _game_domain(self, game: str) -> str:
        return {
            "skyrim": "skyrimspecialedition",
            "skyrimse": "skyrimspecialedition",
            "fallout4": "fallout4",
        }.get(game, "skyrimspecialedition")


def createPlugin() -> mobase.IPluginTool:
    return ModdersOmniImportPlugin()
