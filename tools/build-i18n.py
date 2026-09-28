#!/usr/bin/env python3
"""Compile the translation files into the tables the frontend loads.

    python3 tools/build-i18n.py

Hemma runs the same build itself when the integration loads, so this is only
needed to commit fresh tables. The logic lives in custom_components/hemma/i18n.py.
"""

import importlib.util
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location(
    "hemma_i18n", os.path.join(ROOT, "custom_components/hemma/i18n.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SRC, OUT, STUDIO_OUT, STUDIO = _mod.SRC, _mod.OUT, _mod.STUDIO_OUT, _mod.STUDIO
load, write = _mod.load, _mod.write


def main() -> int:
    if not os.path.isdir(SRC):
        print("no translation source at %s" % SRC, file=sys.stderr)
        return 1
    tables = write(*load())
    print("wrote %s (%d language(s): %s)" % (
        os.path.relpath(OUT, ROOT), len(tables), ", ".join(tables) or "none"))
    print("wrote %s" % os.path.relpath(STUDIO_OUT, ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
