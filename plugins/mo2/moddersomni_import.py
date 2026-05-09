"""
ModdersOmni Import Plugin for Mod Organizer 2

Adds a "Import from ModdersOmni" button to MO2's Tools menu.
Fetches an AI-generated modlist from the ModdersOmni webapp and
queues downloads through MO2's built-in download manager.

Installation: Copy this file to your MO2 plugins/ directory.
"""

import json
import re
import urllib.request
import urllib.error
from typing import List

import mobase

try:
    from PyQt6.QtCore import Qt, QThread, Signal
    from PyQt6.QtWidgets import (
        QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
        QPushButton, QProgressBar, QTextEdit, QMessageBox,
    )
except ImportError:
    from PyQt5.QtCore import Qt, QThread, pyqtSignal as Signal
    from PyQt5.QtWidgets import (
        QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
        QPushButton, QProgressBar, QTextEdit, QMessageBox,
    )

API_BASE = "https://api.moddersomni.com/api"


class FetchWorker(QThread):
    """Background thread for fetching the modlist from the API."""

    finished = Signal(dict)
    error = Signal(str)

    def __init__(self, modlist_id: str, parent=None):
        super().__init__(parent)
        self._modlist_id = modlist_id

    def run(self):
        try:
            url = f"{API_BASE}/modlist/{self._modlist_id}/export"
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                self.finished.emit(data)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            self.error.emit(f"HTTP {e.code}: {body[:200]}")
        except Exception as e:
            self.error.emit(str(e))


class ImportDialog(QDialog):
    """Dialog for importing a modlist from ModdersOmni."""

    def __init__(self, organizer: mobase.IOrganizer, parent=None):
        super().__init__(parent)
        self._organizer = organizer
        self._worker = None
        self._pending_downloads: List[dict] = []
        self._completed = 0

        self.setWindowTitle("Import from ModdersOmni")
        self.setMinimumWidth(480)
        self._build_ui()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(12)

        # Modlist URL / ID
        layout.addWidget(QLabel("Modlist URL or ID:"))
        self._url_input = QLineEdit()
        self._url_input.setPlaceholderText(
            "e.g. https://moddersomni-web.onrender.com/modlist/abc-123 or just the UUID"
        )
        layout.addWidget(self._url_input)

        # Buttons
        btn_row = QHBoxLayout()
        self._import_btn = QPushButton("Import")
        self._import_btn.clicked.connect(self._on_import)
        self._cancel_btn = QPushButton("Cancel")
        self._cancel_btn.clicked.connect(self.reject)
        btn_row.addStretch()
        btn_row.addWidget(self._cancel_btn)
        btn_row.addWidget(self._import_btn)
        layout.addLayout(btn_row)

        # Progress
        self._progress = QProgressBar()
        self._progress.setVisible(False)
        layout.addWidget(self._progress)

        # Log
        self._log = QTextEdit()
        self._log.setReadOnly(True)
        self._log.setMaximumHeight(150)
        self._log.setVisible(False)
        layout.addWidget(self._log)

    def _log_msg(self, msg: str):
        self._log.setVisible(True)
        self._log.append(msg)

    def _extract_id(self, text: str) -> str | None:
        """Extract UUID from a modlist URL or raw UUID string."""
        text = text.strip()
        match = re.search(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            text, re.IGNORECASE,
        )
        return match.group(0) if match else None

    def _on_import(self):
        modlist_id = self._extract_id(self._url_input.text())
        if not modlist_id:
            QMessageBox.warning(
                self, "Invalid Input",
                "Please enter a valid modlist URL or UUID.",
            )
            return

        self._import_btn.setEnabled(False)
        self._progress.setVisible(True)
        self._progress.setRange(0, 0)  # Indeterminate
        self._log_msg(f"Fetching modlist {modlist_id}...")

        self._worker = FetchWorker(modlist_id, self)
        self._worker.finished.connect(self._on_fetch_success)
        self._worker.error.connect(self._on_fetch_error)
        self._worker.start()

    def _on_fetch_error(self, msg: str):
        self._log_msg(f"Error: {msg}")
        self._progress.setVisible(False)
        self._import_btn.setEnabled(True)
        QMessageBox.critical(self, "Fetch Failed", msg)

    def _on_fetch_success(self, data: dict):
        entries = data.get("entries", [])
        game_name = data.get("game_name", "Unknown")
        game_domain = data.get("game_domain", "")

        self._log_msg(
            f"Received {len(entries)} mods for {game_name} ({game_domain})"
        )

        # Filter to entries with nexus_mod_id and file_id
        downloadable = [
            e for e in entries
            if e.get("nexus_mod_id") and e.get("file_id")
        ]
        skipped = len(entries) - len(downloadable)

        if skipped > 0:
            self._log_msg(
                f"Skipping {skipped} entries without resolved file IDs."
            )

        if not downloadable:
            self._log_msg("No downloadable mods found.")
            self._progress.setVisible(False)
            self._import_btn.setEnabled(True)
            return

        self._pending_downloads = downloadable
        self._completed = 0
        self._progress.setRange(0, len(downloadable))
        self._progress.setValue(0)

        dm = self._organizer.downloadManager()
        dm.onDownloadComplete(self._on_download_complete)

        self._log_msg(f"Starting {len(downloadable)} downloads...")
        for entry in downloadable:
            mod_id = entry["nexus_mod_id"]
            file_id = entry["file_id"]
            name = entry.get("name", f"mod-{mod_id}")
            self._log_msg(f"  Queuing: {name} (mod:{mod_id}, file:{file_id})")
            dm.startDownloadNexusFile(mod_id, file_id)

    def _on_download_complete(self, index: int):
        self._completed += 1
        self._progress.setValue(self._completed)
        self._log_msg(f"  Download {self._completed}/{len(self._pending_downloads)} complete")

        if self._completed >= len(self._pending_downloads):
            self._log_msg("All downloads complete!")
            self._set_load_order()

    def _set_load_order(self):
        """Set mod priorities based on the modlist load order."""
        modlist = self._organizer.modList()
        ordered = sorted(self._pending_downloads, key=lambda e: e.get("load_order", 999))

        for priority, entry in enumerate(ordered):
            name = entry.get("name", "")
            if name and modlist.state(name) != mobase.ModState(0):
                modlist.setPriority(name, priority)
                self._log_msg(f"  Set priority {priority}: {name}")

        self._log_msg("Load order applied. Import complete!")
        self._import_btn.setEnabled(True)


class ModdersOmniImport(mobase.IPluginTool):
    """MO2 plugin that imports modlists from the ModdersOmni webapp."""

    def __init__(self):
        super().__init__()
        self._organizer = None

    def init(self, organizer: mobase.IOrganizer) -> bool:
        self._organizer = organizer
        return True

    def name(self) -> str:
        return "ModdersOmni Import"

    def localizedName(self) -> str:
        return "ModdersOmni Import"

    def author(self) -> str:
        return "ModdersOmni"

    def description(self) -> str:
        return "Import AI-generated modlists from the ModdersOmni webapp."

    def version(self) -> mobase.VersionInfo:
        return mobase.VersionInfo(1, 0, 0)

    def requirements(self):
        return []

    def isActive(self) -> bool:
        return True

    def settings(self) -> list:
        return []

    def displayName(self) -> str:
        return "Import from ModdersOmni"

    def tooltip(self) -> str:
        return "Import an AI-generated mod list from ModdersOmni"

    def icon(self):
        return mobase.getIconForExecutable("python.exe")

    def display(self):
        dialog = ImportDialog(self._organizer, self._parentWidget())
        dialog.exec()


def createPlugin() -> mobase.IPlugin:
    return ModdersOmniImport()
