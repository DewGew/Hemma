#!/usr/bin/env python3
"""Build a fake translation so every string can be checked without a translator.

Every English string, on the dashboard and in Hemma Studio, is wrapped in
guillemets and installed as the chosen language. Switch your Home Assistant
profile to that language and anything still in plain English is text that was
never made translatable.

    python3 tools/pseudo-i18n.py            # pretends to be Swedish
    python3 tools/pseudo-i18n.py de
    python3 tools/pseudo-i18n.py --restore  # put the real tables back

It overwrites the two built tables (scripts/hemma-i18n.js and
panel/hemma-studio-i18n.json), never anything in translations/. Restore before
committing: i18ncheck reports the tables as stale until you do.
"""

import importlib.util
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("build_i18n", os.path.join(ROOT, "tools/build-i18n.py"))
build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build)


def main() -> int:
    if "--restore" in sys.argv[1:]:
        return build.main()

    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    lang = args[0] if args else "sv"
    english, sources = build.load()
    sources[lang] = {k: "«%s»" % v for k, v in english.items() if isinstance(v, str)}
    build.write(english, sources)

    studio = sum(1 for k in english if k.startswith(build.STUDIO))
    print("installed a fake %s: %d dashboard and %d Studio string(s)."
          % (lang, len(english) - studio, studio))
    print("Set your HA profile language to %s, hard refresh, and look for the brackets." % lang)
    print("Anything still in plain English was never made translatable.")
    print("Run tools/pseudo-i18n.py --restore when you are done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
