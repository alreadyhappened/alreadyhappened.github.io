#!/usr/bin/env python3
"""Stamp a fresh version onto every page's links to /site.css, /site.js and /boot.js,
so browsers (Safari especially) fetch the new files instead of a saved copy.

Run after changing site.css, site.js or boot.js, from the repo root:
    python3 blog/_build/stamp.py
"""
import glob, pathlib, re, sys, time

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
v = sys.argv[1] if len(sys.argv) > 1 else time.strftime("%Y%m%d%H%M%S")
files = [*ROOT.glob("*.html"), *ROOT.glob("blog/*.html"), ROOT / "blog/_build/build.py"]
n = 0
for f in files:
    s = f.read_text()
    t = re.sub(r'href="/site\.css(\?v=[^"]*)?"', f'href="/site.css?v={v}"', s)
    t = re.sub(r'src="/site\.js(\?v=[^"]*)?"', f'src="/site.js?v={v}"', t)
    t = re.sub(r'src="/boot\.js(\?v=[^"]*)?"', f'src="/boot.js?v={v}"', t)
    if t != s:
        f.write_text(t)
        n += 1
print(f"stamped v={v} on {n} files")
