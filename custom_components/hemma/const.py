"""Constants for the Hemma integration."""

import json
from pathlib import Path

DOMAIN = "hemma"

# manifest.json is the single source of truth: HACS reads it to decide whether
# an update is available, so anything that repeats the number can only drift
# from what the user is actually running.
VERSION = json.loads(
    (Path(__file__).parent / "manifest.json").read_text(encoding="utf-8")
)["version"]

URL_BASE = "/hemma_panel"

# The shared frontend scripts, served by the integration rather than from
# /local. A Lovelace resource under /local is cached for 30 days, so the only
# thing keeping it fresh was a hand-typed ?v= that nobody remembers - and a
# stale hemma-core.js has cost real debugging time. Served with caching off,
# so the URL is stable and a resource entry is set once and never bumped.
#
# Every other frontend module on a typical install already works this way:
# HACS serves its cards from /hacsfiles with its own tag.
SCRIPTS_URL_BASE = "/hemma_scripts"
SCRIPTS_DIR = "www/hemma/scripts"

# Order matters: hemma-core defines what the others build on.
SHARED_SCRIPTS = (
    "hemma-core.js",
    "hemma-icons.js",
    "hemma-redirect.js",
    "layout-offsets.js",
    "layout-card-modified.js",
    "smart-row.js",
    "swipe-card-patch.js",
    "filter-overlay.js",
)

# The integration is "Hemma" - it installs the whole product. This panel is the
# place you go to build the dashboard, so it gets its own name and icon: the
# dashboard is already in the sidebar as "Hemma" with mdi:home-heart, and two
# identical entries is what shipped before.
PANEL_URL = "hemma-studio"
PANEL_TITLE = "Hemma Studio"
PANEL_ICON = "mdi:tablet-dashboard"

# Registered at /hemma before the rename. Removed on setup so an upgrade does
# not leave a dead second entry in the sidebar until the next restart.
LEGACY_PANEL_URL = "hemma"
