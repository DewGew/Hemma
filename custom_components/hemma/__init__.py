"""The Hemma integration."""

from __future__ import annotations

import logging
import os

from homeassistant.components.frontend import (
    async_register_built_in_panel,
    async_remove_panel,
)
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .images import HemmaImagesView
from .templates import HemmaTemplatesView, rebuild_if_stale
from .const import (
    DOMAIN,
    PANEL_ICON,
    PANEL_TITLE,
    LEGACY_PANEL_URL,
    PANEL_URL,
    SCRIPTS_DIR,
    SCRIPTS_URL_BASE,
    SHARED_SCRIPTS,
    URL_BASE,
    VERSION,
)

_LOGGER = logging.getLogger(__name__)


def _lovelace_resources(hass: HomeAssistant):
    """Lovelace's resource collection, or None.

    Read only. The shape has moved between HA versions - a dict in older ones,
    a dataclass now - and resources are read-only when Lovelace runs in yaml
    mode, so every access is defensive: a wrong guess here must never stop the
    integration loading.
    """
    try:
        data = hass.data.get("lovelace")
        if data is None:
            return None
        res = getattr(data, "resources", None)
        if res is None and isinstance(data, dict):
            res = data.get("resources")
        return res if hasattr(res, "async_items") else None
    except Exception:  # noqa: BLE001 - never break setup over a log line
        return None


async def _log_script_resources(hass: HomeAssistant, scripts_dir: str) -> None:
    """Say once, at startup, which resource URLs to use.

    The integration does not rewrite the resource list itself: the collection is
    read-only in yaml mode, and registering a second entry for a script that is
    already loaded from /local would run it twice. So it reports, and the URLs
    it reports never need a version bump again.
    """
    def _present() -> list[str]:
        return [n for n in SHARED_SCRIPTS if os.path.isfile(os.path.join(scripts_dir, n))]

    names = await hass.async_add_executor_job(_present)
    if not names:
        _LOGGER.warning(
            "Hemma: no shared scripts found in %s; the dashboard needs them",
            scripts_dir,
        )
        return

    res = _lovelace_resources(hass)
    stale: list[str] = []
    if res is not None:
        try:
            for item in res.async_items():
                url = str(item.get("url", ""))
                if url.startswith("/local/hemma/scripts/"):
                    stale.append(url)
        except Exception:  # noqa: BLE001
            stale = []

    if stale:
        _LOGGER.warning(
            "Hemma: %d dashboard resource(s) still load from /local, which the "
            "browser caches for 30 days - a fix can look like it did not apply. "
            "Repoint each to %s/<file> and drop the ?v=; it never needs bumping "
            "again. Currently: %s",
            len(stale),
            SCRIPTS_URL_BASE,
            ", ".join(sorted(stale)),
        )
    else:
        _LOGGER.debug(
            "Hemma: serving %d shared script(s) from %s", len(names), SCRIPTS_URL_BASE
        )


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Register the panel assets and the sidebar entry."""
    panel_dir = hass.config.path(f"custom_components/{DOMAIN}/panel")

    # The bundle is derived from the template tree; rebuild it before the panel
    # can serve a stale copy into a dashboard Save.
    await hass.async_add_executor_job(rebuild_if_stale, hass.config.config_dir)

    scripts_dir = hass.config.path(SCRIPTS_DIR)

    # One call is atomic, so on a reload the already-registered panel path took
    # the scripts path with it. cache_headers=False keeps the URL stable.
    for url, path in (
        (URL_BASE, panel_dir),
        (SCRIPTS_URL_BASE, scripts_dir),
    ):
        try:
            await hass.http.async_register_static_paths(
                [StaticPathConfig(url, path, False)]
            )
        except RuntimeError:
            _LOGGER.debug("Hemma: %s is already served", url)

    await _log_script_resources(hass, scripts_dir)

    # The panel URL carries the file mtime so editing the JS busts the browser's
    # module cache without needing a version bump or a manual hard refresh.
    def _stamp() -> int:
        try:
            return int(os.path.getmtime(os.path.join(panel_dir, "hemma-panel.js")))
        except OSError:
            return 0

    stamp = await hass.async_add_executor_job(_stamp)

    if not hass.data.get(f"{DOMAIN}_views"):
        hass.http.register_view(HemmaImagesView())
        hass.http.register_view(HemmaTemplatesView())
        hass.data[f"{DOMAIN}_views"] = True

    # Remove first so a version bump re-registers cleanly instead of being skipped.
    async_remove_panel(hass, PANEL_URL, warn_if_unknown=False)
    async_remove_panel(hass, LEGACY_PANEL_URL, warn_if_unknown=False)
    async_register_built_in_panel(
        hass=hass,
        component_name="custom",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path=PANEL_URL,
        require_admin=True,
        config={
            "_panel_custom": {
                "name": "hemma-panel",
                "embed_iframe": False,
                "trust_external": False,
                "module_url": f"{URL_BASE}/hemma-panel.js?v={VERSION}.{stamp}",
            }
        },
    )
    _LOGGER.debug("Registered Hemma panel at /%s", PANEL_URL)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Remove the sidebar entry."""
    async_remove_panel(hass, PANEL_URL, warn_if_unknown=False)
    return True
