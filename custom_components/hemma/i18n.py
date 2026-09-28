"""Compile the translation files into the tables the frontend loads.

en.json is the key reference, not a shipped table: every call site carries its
English default inline so a template painting before the table loads still
reads correctly. Only the other languages are emitted.

Keys under studio. are Hemma Studio's own text. They go to
panel/hemma-studio-i18n.json instead, keyed by their English, so dashboards
never load them.

No Home Assistant imports: tools/build-i18n.py loads this file directly.
"""

from __future__ import annotations

import json
import logging
import os

_LOGGER = logging.getLogger(__name__)

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "translations", "dashboard")
OUT = os.path.join(HERE, "scripts", "hemma-i18n.js")
STUDIO_OUT = os.path.join(HERE, "panel", "hemma-studio-i18n.json")
STUDIO = "studio."

RUNTIME = """// Generated from custom_components/hemma/translations/dashboard/*.json when
// Hemma loads, or by tools/build-i18n.py. Do not edit; edit those files.
(function () {
  var TABLES = %s;

  var cache = { lang: null, table: null };

  function resolve() {
    var root = document.querySelector('home-assistant');
    var lang = (root && root.hass && root.hass.language) || 'en';
    if (cache.lang === lang) return cache.table;
    cache.lang = lang;
    cache.table = TABLES[lang] || TABLES[lang.split('-')[0]] || null;
    return cache.table;
  }

  function fill(s, vars) {
    if (!vars) return s;
    return s.replace(/\\{(\\w+)\\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
    });
  }

  window._hemmaT = function (key, en, vars) {
    var t = resolve();
    var s = (t && typeof t[key] === 'string' && t[key]) || en;
    return fill(typeof s === 'string' ? s : key, vars);
  };

  window._hemmaI18NLangs = Object.keys(TABLES);

  // Lovelace appends new resources, so this file may load either side of
  // hemma-core.js. Kick whichever waiters core has already flushed.
  if (!resolve()) return;
  var w = window._hemmaCoreWaiters || window._hemmaKicked;
  if (!w || typeof window.hemmaKick !== 'function') return;
  setTimeout(function () {
    w.forEach(function (el) { window.hemmaKick(el); });
  }, 0);
})();
"""


def load(strict=True):
    with open(os.path.join(SRC, "en.json"), encoding="utf-8") as fh:
        english = json.load(fh)
    sources = {}
    for name in sorted(os.listdir(SRC)):
        if not name.endswith(".json") or name == "en.json":
            continue
        try:
            with open(os.path.join(SRC, name), encoding="utf-8") as fh:
                data = json.load(fh)
            if not isinstance(data, dict):
                raise ValueError("expected an object of \"key\": \"text\" pairs")
        except (OSError, ValueError) as err:
            if strict:
                raise
            _LOGGER.error("Hemma: skipped translations/dashboard/%s, which is not valid JSON: %s",
                          name, err)
            continue
        sources[name[: -len(".json")]] = data
    return english, sources


def render(english, sources):
    tables = {}
    studio = {}
    for lang, data in sorted(sources.items()):
        tables[lang] = {k: v for k, v in sorted(data.items())
                        if isinstance(v, str) and not k.startswith(STUDIO)}
        studio[lang] = {english[k]: v for k, v in sorted(data.items())
                        if isinstance(v, str) and v and k.startswith(STUDIO) and k in english}
    body = json.dumps(tables, ensure_ascii=False, indent=2, sort_keys=True)
    js = RUNTIME % body
    studio_json = json.dumps(studio, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
    return tables, js, studio_json


def _read(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return None


def write(english, sources):
    tables, js, studio_json = render(english, sources)
    for path, text in ((OUT, js), (STUDIO_OUT, studio_json)):
        if _read(path) != text:
            with open(path + ".tmp", "w", encoding="utf-8") as fh:
                fh.write(text)
            os.replace(path + ".tmp", path)
    return tables


def rebuild_if_stale() -> bool:
    """Rebuild the tables when a translation file changed. Blocking."""
    try:
        english, sources = load(strict=False)
        _tables, js, studio_json = render(english, sources)
    except Exception:
        # A malformed language file must not take the dashboard down with it.
        _LOGGER.exception("Hemma: could not read the translation files")
        return False
    if _read(OUT) == js and _read(STUDIO_OUT) == studio_json:
        return False
    try:
        write(english, sources)
    except OSError:
        _LOGGER.exception("Hemma: could not write the translation tables")
        return False
    _LOGGER.info("Hemma: rebuilt the translation tables (%s)", ", ".join(sources) or "English only")
    return True
