#!/usr/bin/env python3
"""Fetch every post from alreadyhappened.xyz into blog/_build/raw/<slug>.json.

Run:  python3 blog/_build/fetch.py          (only fetch posts not yet cached)
      python3 blog/_build/fetch.py --all    (refetch everything)
"""
import json, os, sys, time, urllib.request

BASE = "https://alreadyhappened.xyz/api/v1"
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
os.makedirs(RAW, exist_ok=True)

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (stefankelly.com blog sync)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def archive():
    posts, offset = [], 0
    while True:
        page = get(f"{BASE}/archive?sort=new&limit=20&offset={offset}")
        if not page:
            break
        posts += page
        offset += 20
    return posts

def main():
    refetch_all = "--all" in sys.argv
    posts = archive()
    json.dump(posts, open(os.path.join(HERE, "archive.json"), "w"), indent=1)
    new = []
    for p in posts:
        slug = p["slug"]
        path = os.path.join(RAW, slug + ".json")
        if os.path.exists(path) and not refetch_all:
            continue
        full = get(f"{BASE}/posts/{slug}")
        json.dump(full, open(path, "w"), indent=1)
        new.append(slug)
        time.sleep(0.5)
    print(f"{len(posts)} posts in archive, {len(new)} fetched: {', '.join(new) or 'none'}")

if __name__ == "__main__":
    main()
