#!/usr/bin/env python3
"""Build the blog from the Substack cache.

  python3 blog/_build/fetch.py     # pull any new posts into blog/_build/raw/
  python3 blog/_build/build.py     # regenerate blog.html and blog/<post>.html

Editorial choices (filenames, categories, most-read list) live in posts.json.
"""
import html as htmlmod
import json
import os
import re
from datetime import datetime, timezone

from lxml import html as LH
from lxml import etree

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BLOG_DIR = os.path.join(ROOT, "blog")

CFG = json.load(open(os.path.join(HERE, "posts.json")))
FILES = CFG["files"]
CATS = CFG["categories"]
CAT_ORDER = CFG["category_order"]
POPULAR = CFG["popular"]

SITE_NAME = "Already Happened"
AUTHOR = "Stefan Kelly"
SUBSTACK = "https://alreadyhappened.xyz"
WPM = 230

SITE_NAV = [
    ("/", "About"),
    ("/worked-on.html", "Things I have worked on"),
    ("/working-on.html", "Things I am working on"),
    ("/artefacts.html", "Artefacts"),
    ("/experiments.html", "Experiments"),
    ("/blog.html", "Blog"),
]

# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------

def esc(s):
    return htmlmod.escape(s or "", quote=True)


def slugify(text):
    text = re.sub(r"[^\w\s-]", "", (text or "").lower())
    text = re.sub(r"[\s_]+", "-", text).strip("-")
    return text or "section"


def cdn(url, width=None):
    """Return a Substack CDN url resized to `width` (keeps the original if no width)."""
    if not url:
        return url
    m = re.match(r"(https://substackcdn\.com/image/fetch/\$s_![^!]+!,)(.*?)(/https?%3A.*)$", url)
    if not m:
        return url
    head, _opts, tail = m.groups()
    opts = "f_auto,q_auto:good,fl_progressive:steep"
    if width:
        opts = f"w_{width},c_limit," + opts
    return head + opts + tail


def image_key(url):
    m = re.search(r"images%2F([0-9a-f-]+)_", url or "")
    return m.group(1) if m else None


def dims_from_url(url):
    m = re.search(r"_(\d+)x(\d+)\.[a-z]+", url or "")
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)


def fmt_date(iso):
    d = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)
    return d.strftime("%-d %B %Y"), d.strftime("%Y-%m-%d"), d.year


def reading_time(words):
    mins = max(1, round((words or 0) / WPM))
    return f"{mins} min read"


def luminance(rgb):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def accent_from_palette(pal):
    """Pick a dark, readable accent colour from Substack's cover palette."""
    if not pal:
        return "#1f1f1f"
    for key in ("DarkVibrant", "DarkMuted", "Vibrant", "Muted"):
        entry = pal.get(key)
        if entry and entry.get("rgb"):
            rgb = entry["rgb"]
            if luminance(rgb) < 0.18:
                return "#%02x%02x%02x" % tuple(int(c) for c in rgb)
    # darken whatever is available
    for key in ("Muted", "Vibrant", "LightMuted"):
        entry = pal.get(key)
        if entry and entry.get("rgb"):
            r, g, b = [int(c * 0.45) for c in entry["rgb"]]
            return "#%02x%02x%02x" % (r, g, b)
    return "#1f1f1f"


# ----------------------------------------------------------------------------
# load posts
# ----------------------------------------------------------------------------

def load_posts():
    posts = []
    for name in os.listdir(RAW):
        if not name.endswith(".json"):
            continue
        d = json.load(open(os.path.join(RAW, name)))
        slug = d["slug"]
        tags = [t["name"] for t in d.get("postTags") or []]
        cat = CATS.get(slug) or (tags[0] if tags else "Notes")
        pretty, iso, year = fmt_date(d["post_date"])
        cover = d.get("cover_image") or ""
        cw, chh = dims_from_url(cover)
        posts.append({
            "slug": slug,
            "file": FILES.get(slug, slug),
            "title": d["title"].strip(),
            "subtitle": (d.get("subtitle") or "").strip(),
            "date": pretty,
            "iso": iso,
            "year": year,
            "category": cat,
            "cover": cover,
            "cover_w": cw,
            "cover_h": chh,
            "words": d.get("wordcount") or 0,
            "reactions": d.get("reaction_count") or 0,
            "canonical": d.get("canonical_url") or f"{SUBSTACK}/p/{slug}",
            "accent": accent_from_palette(d.get("coverImagePalette")),
            "body_html": d.get("body_html") or "",
        })
    posts.sort(key=lambda p: p["iso"], reverse=True)
    return posts


# ----------------------------------------------------------------------------
# clean Substack body html
# ----------------------------------------------------------------------------

KEEP_ATTRS = {
    "a": {"href"},
    "img": {"src", "srcset", "sizes", "alt", "width", "height", "loading"},
    "ol": {"start"},
    "iframe": {"src", "allow", "allowfullscreen"},
}

DROP_SELECTORS = [
    ".subscription-widget-wrap-editor", ".subscription-widget", ".captioned-button-wrap",
    "p.button-wrapper", "button", "svg", "form", ".fallback-failure",
    ".third-party-cookie-check-iframe", "iframe.tiktok-iframe", "label.hide-text",
    ".image-link-expand", ".tiktok-wrap:not(.static)", ".community-widget",
]



def _css_step(step):
    """Translate one simple selector (tag, .cls, tag.cls, :not(.cls), [attr]) to an XPath step."""
    m = re.match(r"^([a-zA-Z0-9]*)(.*)$", step)
    tag = m.group(1) or "*"
    conds = []
    for part in re.findall(r":not\([^)]*\)|[.#\[][^.#\[:]*", m.group(2)):
        if part.startswith("."):
            conds.append(f"contains(concat(' ', normalize-space(@class), ' '), ' {part[1:]} ')")
        elif part.startswith("["):
            conds.append("@" + part[1:-1])
        elif part.startswith(":not("):
            inner = part[5:-1]
            conds.append("not(" + _css_step(inner).split("[", 1)[1][:-1] + ")")
    return tag + ("[" + " and ".join(conds) + "]" if conds else "")


def _css_to_xpath(selector):
    paths = []
    for sel in selector.split(","):
        steps = [t for t in re.split(r"\s*>\s*", sel.strip()) if t]
        xp = ".//" + _css_step(steps[0])
        for st in steps[1:]:
            xp += "/" + _css_step(st)
        paths.append(xp)
    return " | ".join(paths)


def select(root, selector):
    return root.xpath(_css_to_xpath(selector))


def data_attrs(el):
    raw = el.get("data-attrs")
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


def remove(el):
    parent = el.getparent()
    if parent is None:
        return
    if el.tail:
        prev = el.getprevious()
        if prev is not None:
            prev.tail = (prev.tail or "") + el.tail
        else:
            parent.text = (parent.text or "") + el.tail
    parent.remove(el)


def replace(el, new):
    new.tail = el.tail
    el.getparent().replace(el, new)


def unwrap(el):
    """Replace element by its children/text."""
    parent = el.getparent()
    idx = parent.index(el)
    if el.text:
        if idx == 0:
            parent.text = (parent.text or "") + el.text
        else:
            prev = parent[idx - 1]
            prev.tail = (prev.tail or "") + el.text
    for child in list(el):
        parent.insert(idx, child)
        idx += 1
    if el.tail:
        if idx == 0:
            parent.text = (parent.text or "") + el.tail
        else:
            prev = parent[idx - 1]
            prev.tail = (prev.tail or "") + el.tail
    parent.remove(el)


def text_of(el):
    return " ".join("".join(el.itertext()).split())


def build_figure(container, wide_threshold=1000):
    img = container.find(".//img")
    if img is None:
        return None
    attrs = data_attrs(img)
    src = img.get("src") or attrs.get("src")
    w = attrs.get("width") or img.get("width")
    h = attrs.get("height") or img.get("height")
    try:
        w = int(float(w)) if w else None
        h = int(float(h)) if h else None
    except ValueError:
        w = h = None
    alt = img.get("alt") or ""
    if alt in ("Image", "image") or alt.startswith("http"):
        alt = ""
    cap_el = container.find(".//figcaption")
    caption = None
    if cap_el is not None:
        caption = LH.tostring(cap_el, encoding="unicode", method="html")
        caption = re.sub(r"^<figcaption[^>]*>|</figcaption>$", "", caption).strip()

    fig = LH.Element("figure")
    fig.set("class", "essay-figure " + ("is-wide" if (w or 0) >= wide_threshold else "is-natural"))
    if w and h:
        fig.set("style", f"--w:{w};--h:{h}")
    a = etree.SubElement(fig, "a")
    a.set("href", cdn(src))
    a.set("class", "figure-link")
    new_img = etree.SubElement(a, "img")
    new_img.set("src", cdn(src, 1456))
    new_img.set("srcset", ", ".join(f"{cdn(src, s)} {s}w" for s in (640, 1024, 1456)))
    new_img.set("sizes", "(max-width: 900px) 100vw, 900px")
    new_img.set("alt", alt)
    new_img.set("loading", "lazy")
    if w and h:
        new_img.set("width", str(w))
        new_img.set("height", str(h))
    if caption:
        fc = etree.SubElement(fig, "figcaption")
        frag = LH.fragment_fromstring(caption, create_parent="span")
        fc.text = frag.text
        for child in frag:
            fc.append(child)
    return fig, image_key(src), caption


def clean_body(body_html, post, slug_to_file):
    root = LH.fragment_fromstring(body_html, create_parent="div")

    # Substack wraps runs of text in spans; flatten them before we add our own
    for sp in select(root, "span"):
        unwrap(sp)

    # tiktok static cards (nested inside the wrapper we are about to drop)
    for tk in select(root, ".tiktok-wrap.static"):
        author = select(tk, "a.author")
        title = select(tk, "a.title")
        img = tk.find(".//img")
        link = tk.find(".//a")
        href = (title[0].get("href") if title else (link.get("href") if link is not None else "#"))
        card = LH.Element("a")
        card.set("class", "embed-card embed-tiktok")
        card.set("href", href)
        if img is not None and img.get("src"):
            im = etree.SubElement(card, "img"); im.set("src", img.get("src")); im.set("alt", ""); im.set("loading", "lazy")
        box = etree.SubElement(card, "span"); box.set("class", "embed-body")
        k = etree.SubElement(box, "span"); k.set("class", "embed-kicker")
        k.text = "TikTok · " + (text_of(author[0]) if author else "")
        t = etree.SubElement(box, "strong"); t.text = text_of(title[0]) if title else "Watch on TikTok"
        target = tk
        anc = tk.getparent()
        while anc is not None and anc is not root:
            if "tiktok-wrap" in (anc.get("class") or ""):
                target = anc
            anc = anc.getparent()
        replace(target, card)

    # drop noise
    for sel in DROP_SELECTORS:
        for el in select(root, sel):
            if el.getparent() is not None:
                remove(el)

    hero_caption = None

    # figures
    first_figure = True
    for c in select(root, ".captioned-image-container"):
        built = build_figure(c)
        if built is None:
            remove(c)
            continue
        fig, key, caption = built
        if first_figure and key and key == image_key(post["cover"]) and root.index(c) <= 2 and \
                not (root.text or "").strip():
            # the cover already sits in the hero; keep only its caption
            hero_caption = caption
            remove(c)
        else:
            replace(c, fig)
        first_figure = False

    # loose images inside paragraphs
    for img in select(root, "p > img, div > img"):
        p = img.getparent()
        if p.tag == "figure":
            continue
        fig = LH.Element("figure")
        fig.set("class", "essay-figure is-natural")
        a = etree.SubElement(fig, "a"); a.set("href", img.get("src")); a.set("class", "figure-link")
        ni = etree.SubElement(a, "img"); ni.set("src", img.get("src")); ni.set("alt", ""); ni.set("loading", "lazy")
        if p.tag == "p" and not text_of(p):
            replace(p, fig)
        else:
            replace(img, fig)

    # pull quotes
    for pq in select(root, ".pullquote"):
        aside = LH.Element("aside")
        aside.set("class", "pullquote")
        for child in list(pq):
            aside.append(child)
        replace(pq, aside)

    # embedded Substack posts -> cards
    for emb in select(root, ".digest-post-embed"):
        a = data_attrs(emb)
        url = a.get("canonical_url") or ""
        m = re.search(r"alreadyhappened\.xyz/p/([a-z0-9-]+)", url)
        if m and m.group(1) in slug_to_file:
            href = f"/blog/{slug_to_file[m.group(1)]}.html"
        else:
            href = url.split("?")[0]
        card = LH.Element("a")
        card.set("class", "embed-card")
        card.set("href", href)
        if a.get("cover_image"):
            im = etree.SubElement(card, "img")
            im.set("src", cdn(a["cover_image"], 480)); im.set("alt", ""); im.set("loading", "lazy")
        box = etree.SubElement(card, "span"); box.set("class", "embed-body")
        k = etree.SubElement(box, "span"); k.set("class", "embed-kicker"); k.text = "Read next"
        t = etree.SubElement(box, "strong"); t.text = a.get("title") or "Read the essay"
        if a.get("caption"):
            cp = etree.SubElement(box, "span"); cp.set("class", "embed-caption"); cp.text = a["caption"]
        replace(emb, card)

    # substack-hosted video: nothing to embed, point at the original
    for v in select(root, ".native-video-embed"):
        p = LH.Element("p")
        p.set("class", "embed-missing")
        p.text = "There is a video here that only plays on "
        a = etree.SubElement(p, "a"); a.set("href", post["canonical"]); a.text = "the original post"
        a.tail = "."
        replace(v, p)

    # preformatted verse
    for pf in select(root, ".preformatted-block"):
        pre = pf.find(".//pre")
        new = LH.Element("pre")
        new.set("class", "verse")
        new.text = pre.text_content() if pre is not None else pf.text_content()
        replace(pf, new)

    # headings: Substack's editor uses h1 for section titles
    for h in select(root, "h1"):
        h.tag = "h2"
    for h in select(root, "h4"):
        h.tag = "h3"
    for h in select(root, "h5, h6"):
        h.tag = "h4"

    # <div><hr></div> -> <hr>
    for hr in select(root, "div > hr"):
        d = hr.getparent()
        if d is not root and len(d) == 1 and not text_of(d):
            replace(d, LH.Element("hr"))

    # unwrap stray divs
    for d in list(root.iter("div")):
        if d is root:
            continue
        if d.getparent() is not None:
            unwrap(d)

    # li > p -> li
    for li in select(root, "li"):
        ps = [c for c in li if c.tag == "p"]
        if len(ps) == len(list(li)) and len(ps) >= 1 and not (li.text or "").strip():
            for p in ps:
                unwrap(p)

    # rewrite internal links
    for a in select(root, "a[href]"):
        if (a.getparent().get("class") or "") == "embed-missing":
            continue
        href = a.get("href")
        m = re.search(r"alreadyhappened\.xyz/p/([a-z0-9-]+)", href)
        if m and m.group(1) in slug_to_file:
            a.set("href", f"/blog/{slug_to_file[m.group(1)]}.html")
        elif "alreadyhappened.xyz" in href:
            a.set("href", href.split("?")[0])

    # remove empty paragraphs
    for p in select(root, "p"):
        if not text_of(p) and p.find(".//img") is None and p.find(".//iframe") is None:
            remove(p)
    for el in select(root, "br"):
        # collapse runs of <br> at the end of paragraphs
        if el.getnext() is None and not (el.tail or "").strip():
            remove(el)

    # strip attributes
    for el in root.iter():
        if not isinstance(el.tag, str):
            continue
        keep = KEEP_ATTRS.get(el.tag, set())
        for attr in list(el.attrib):
            if attr in keep or attr == "class" and el.tag in ("figure", "a", "aside", "p", "pre", "span", "strong") \
                    or attr == "style" and el.tag == "figure" or attr == "id" and el.tag in ("h2", "h3", "h4"):
                continue
            del el.attrib[attr]
        if el.tag == "a" and el.get("class") not in ("figure-link", "embed-card", "embed-card embed-tiktok"):
            if "class" in el.attrib:
                del el.attrib["class"]
        if el.tag in ("p", "strong") and "class" in el.attrib and el.get("class") not in ("embed-missing", "preamble", "lede"):
            del el.attrib["class"]

    # heading ids and table of contents
    toc = []
    seen = set()
    for h in select(root, "h2, h3"):
        label = text_of(h)
        if not label:
            continue
        hid = slugify(label)[:60]
        base, n = hid, 2
        while hid in seen:
            hid = f"{base}-{n}"; n += 1
        seen.add(hid)
        h.set("id", hid)
        toc.append({"id": hid, "text": label, "level": 2 if h.tag == "h2" else 3})

    # first substantial paragraph gets the drop cap; short all-italic openers are preambles
    for child in root:
        if child.tag != "p" or not text_of(child):
            continue
        ems = [c for c in child if c.tag == "em"]
        all_italic = len(ems) == 1 and not (child.text or "").strip() and not (ems[0].tail or "").strip()
        if all_italic:
            child.set("class", "preamble")
            continue
        child.set("class", "lede")
        break

    out = "".join(LH.tostring(c, encoding="unicode", method="html") for c in root)
    if root.text and root.text.strip():
        out = f"<p>{esc(root.text.strip())}</p>" + out
    return out, toc, hero_caption


# ----------------------------------------------------------------------------
# templates
# ----------------------------------------------------------------------------

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta property="og:title" content="{og_title}">
  <meta property="og:description" content="{description}">
  <meta property="og:type" content="{og_type}">
  {og_image}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..700,0..100,0..1;1,9..144,300..700,0..100,0..1&family=Inter:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/blog.css">
  <script defer src="/cf-analytics.js"></script>
  <script defer src="/blog.js"></script>
</head>
<body class="{body_class}" style="--accent:{accent}">
<div class="progress" aria-hidden="true"><span></span></div>
<div class="shell">
"""

FOOT = """</div>
<div class="lightbox" hidden><img alt=""><button class="lightbox-close" aria-label="Close">×</button></div>
</body>
</html>
"""


def site_nav_html(current="/blog.html"):
    items = []
    for href, label in SITE_NAV:
        cls = ' class="is-current"' if href == current else ""
        items.append(f'<li><a href="{href}"{cls}>{esc(label)}</a></li>')
    return "\n".join(items)


def sidebar_html(mode, posts, post=None, toc=None, cat_counts=None, year_counts=None, prev_post=None, next_post=None):
    """mode: 'index' or 'post'."""
    parts = []
    parts.append(f"""
<aside class="sidebar" id="sidebar">
  <div class="sidebar-top">
    <a class="wordmark" href="/blog.html">
      <span class="wordmark-title">{esc(SITE_NAME)}</span>
    </a>
    <button class="menu-toggle" aria-expanded="false" aria-controls="sidebar-body">Menu</button>
  </div>
  <div class="sidebar-body" id="sidebar-body">
""")
    if mode == "index":
        parts.append(f"""
    <label class="search">
      <span class="visually-hidden">Search essays</span>
      <input type="search" id="search" placeholder="Search essays" autocomplete="off">
      <kbd>/</kbd>
    </label>

    <nav class="nav-block" aria-label="Browse by category">
      <h2 class="nav-label">Browse</h2>
      <ul class="nav-list" id="cat-nav">
        <li><a href="#" data-filter="all" class="is-active"><span>All essays</span><span class="count">{len(posts)}</span></a></li>
""")
        for c in CAT_ORDER:
            if cat_counts.get(c):
                parts.append(f'        <li><a href="#" data-filter="{esc(c)}"><span>{esc(c)}</span><span class="count">{cat_counts[c]}</span></a></li>\n')
        parts.append("""      </ul>
    </nav>

    <nav class="nav-block" aria-label="Browse by year">
      <h2 class="nav-label">Years</h2>
      <ul class="nav-list nav-years" id="year-nav">
""")
        for y in sorted(year_counts, reverse=True):
            parts.append(f'        <li><a href="#year-{y}"><span>{y}</span><span class="count">{year_counts[y]}</span></a></li>\n')
        parts.append("""      </ul>
    </nav>

    <nav class="nav-block" aria-label="Most read">
      <h2 class="nav-label">Most read</h2>
      <ol class="nav-list nav-popular">
""")
        by_slug = {p["slug"]: p for p in posts}
        for i, s in enumerate(POPULAR, 1):
            p = by_slug.get(s)
            if p:
                parts.append(f'        <li><a href="/blog/{p["file"]}.html"><span class="num">{i}</span><span>{esc(p["title"])}</span></a></li>\n')
        parts.append("      </ol>\n    </nav>\n")
    else:
        parts.append("""
    <a class="back" href="/blog.html"><span class="arrow">←</span> All essays</a>
    <div class="now-reading">
      <h2 class="nav-label">Now reading</h2>
      <p class="now-title">""" + esc(post["title"]) + """</p>
      <p class="now-progress"><span id="progress-text">0% read</span> · """ + reading_time(post["words"]) + """</p>
    </div>
""")
        if toc and len(toc) >= 2:
            parts.append("""
    <nav class="nav-block toc" aria-label="In this essay">
      <h2 class="nav-label">In this essay</h2>
      <ol class="toc-list" id="toc">
""")
            for t in toc:
                lvl = ' class="is-sub"' if t["level"] == 3 else ""
                parts.append(f'        <li{lvl}><a href="#{t["id"]}">{esc(t["text"])}</a></li>\n')
            parts.append("      </ol>\n    </nav>\n")
        parts.append('\n    <nav class="nav-block" aria-label="Next and previous">\n      <h2 class="nav-label">Continue</h2>\n      <ul class="nav-list nav-adjacent">\n')
        if next_post:
            parts.append(f'        <li><a href="/blog/{next_post["file"]}.html" rel="next"><span class="dir">Newer</span><span>{esc(next_post["title"])}</span></a></li>\n')
        if prev_post:
            parts.append(f'        <li><a href="/blog/{prev_post["file"]}.html" rel="prev"><span class="dir">Older</span><span>{esc(prev_post["title"])}</span></a></li>\n')
        parts.append("      </ul>\n    </nav>\n")
        parts.append(f'\n    <p class="sidebar-source"><a href="{esc(post["canonical"])}">Originally published on Substack ↗</a></p>\n')

    parts.append(f"""
    <nav class="nav-block site-nav" aria-label="Site">
      <h2 class="nav-label">{esc(AUTHOR)}</h2>
      <ul class="nav-list">
{site_nav_html()}
      </ul>
    </nav>
    <p class="sidebar-foot"><a href="{SUBSTACK}">alreadyhappened.xyz</a></p>
  </div>
</aside>
""")
    return "".join(parts)


def card_html(p, kind="row", eyebrow=None):
    thumb = ""
    if p["cover"]:
        width = 1200 if kind == "hero" else 640
        thumb = f'<img src="{esc(cdn(p["cover"], width))}" alt="" loading="{"eager" if kind == "hero" else "lazy"}">'
    eyebrow = eyebrow or p["category"]
    shape = ""
    if kind == "hero" and p["cover_w"] and p["cover_h"] and p["cover_w"] / p["cover_h"] < 1.3:
        shape = " is-square"
    return f"""
<a class="card card-{kind}{shape}" href="/blog/{p["file"]}.html" data-category="{esc(p["category"])}" data-year="{p["year"]}" data-search="{esc((p["title"] + " " + p["subtitle"] + " " + p["category"]).lower())}" style="--accent:{p["accent"]}">
  <span class="card-media">{thumb}</span>
  <span class="card-body">
    <span class="eyebrow">{esc(eyebrow)}</span>
    <span class="card-title">{esc(p["title"])}</span>
    {f'<span class="card-sub">{esc(p["subtitle"])}</span>' if p["subtitle"] else ''}
    <span class="card-meta"><time datetime="{p["iso"]}">{p["date"]}</time><span class="dot">·</span>{reading_time(p["words"])}</span>
  </span>
</a>"""


def build_index(posts):
    cat_counts = {}
    year_counts = {}
    for p in posts:
        cat_counts[p["category"]] = cat_counts.get(p["category"], 0) + 1
        year_counts[p["year"]] = year_counts.get(p["year"], 0) + 1

    latest = posts[0]
    by_slug = {p["slug"]: p for p in posts}
    featured = [by_slug[s] for s in POPULAR[:3] if s in by_slug]

    body = [HEAD.format(
        title=f"Blog — {AUTHOR}",
        description="Essays on behaviour, culture and technology by Stefan Kelly, collected from Already Happened.",
        og_title=f"{SITE_NAME} — essays by {AUTHOR}",
        og_type="website",
        og_image=f'<meta property="og:image" content="{esc(cdn(latest["cover"], 1200))}">' if latest["cover"] else "",
        body_class="page-index",
        accent="#1f1f1f",
    )]
    body.append(sidebar_html("index", posts, cat_counts=cat_counts, year_counts=year_counts))
    body.append(f"""
<main class="main" id="main">
  <header class="index-header">
    <h1 class="index-title">{esc(SITE_NAME)}</h1>
  </header>

  <section class="featured" aria-label="Latest essay">
    <h2 class="section-label">Latest</h2>
    {card_html(latest, "hero", eyebrow="Latest · " + latest["category"])}
  </section>

  <section class="most-read" aria-label="Most read">
    <h2 class="section-label">Most read</h2>
    <div class="tile-grid">
      {"".join(card_html(p, "tile") for p in featured)}
    </div>
  </section>

  <section class="archive" aria-label="All essays" id="archive">
    <h2 class="section-label"><span>All essays</span><span class="result-count" id="result-count"></span></h2>
""")
    for y in sorted(year_counts, reverse=True):
        body.append(f'    <div class="year" id="year-{y}" data-year="{y}">\n      <div class="year-label"><span>{y}</span></div>\n      <div class="year-posts">\n')
        for p in posts:
            if p["year"] == y:
                body.append(card_html(p, "row"))
        body.append("\n      </div>\n    </div>\n")
    body.append("""    <p class="empty" id="empty" hidden>No essays match.</p>
  </section>

  <footer class="main-foot">
    <p><a href=\"""" + SUBSTACK + """\">alreadyhappened.xyz</a></p>
  </footer>
</main>
""")
    body.append(FOOT)
    with open(os.path.join(ROOT, "blog.html"), "w") as f:
        f.write("".join(body))


def related(post, posts, n=3):
    same = [p for p in posts if p["slug"] != post["slug"] and p["category"] == post["category"]]
    same.sort(key=lambda p: (-p["reactions"], p["iso"]))
    out = same[:n]
    if len(out) < n:
        rest = [p for p in posts if p["slug"] != post["slug"] and p not in out]
        rest.sort(key=lambda p: -p["reactions"])
        out += rest[: n - len(out)]
    return out


def build_post(post, posts, idx, slug_to_file):
    content, toc, hero_caption = clean_body(post["body_html"], post, slug_to_file)
    prev_post = posts[idx + 1] if idx + 1 < len(posts) else None   # older
    next_post = posts[idx - 1] if idx > 0 else None                # newer

    ratio = (post["cover_w"] or 1) / (post["cover_h"] or 1)
    hero_class = "hero-wide" if ratio >= 1.45 else "hero-natural"
    hero = ""
    if post["cover"]:
        hero = f"""
    <figure class="hero {hero_class}" style="--w:{post['cover_w'] or 3};--h:{post['cover_h'] or 2}">
      <a class="figure-link" href="{esc(cdn(post['cover']))}"><img src="{esc(cdn(post['cover'], 1600))}" srcset="{esc(cdn(post['cover'], 800))} 800w, {esc(cdn(post['cover'], 1600))} 1600w" sizes="(max-width: 900px) 100vw, 1100px" alt="" width="{post['cover_w'] or ''}" height="{post['cover_h'] or ''}" fetchpriority="high"></a>
      {f'<figcaption>{hero_caption}</figcaption>' if hero_caption else ''}
    </figure>"""

    desc = post["subtitle"] or f"An essay by {AUTHOR}."
    html_out = [HEAD.format(
        title=f"{esc(post['title'])} — {AUTHOR}",
        description=esc(desc),
        og_title=esc(post["title"]),
        og_type="article",
        og_image=f'<meta property="og:image" content="{esc(cdn(post["cover"], 1200))}">' if post["cover"] else "",
        body_class="page-post",
        accent=post["accent"],
    )]
    html_out.append(sidebar_html("post", posts, post=post, toc=toc, prev_post=prev_post, next_post=next_post))

    rel_cards = "".join(card_html(p, "tile") for p in related(post, posts))
    adjacent = ""
    if prev_post or next_post:
        adjacent = '<nav class="adjacent" aria-label="Adjacent essays">'
        if prev_post:
            adjacent += f'<a class="adjacent-link" href="/blog/{prev_post["file"]}.html" rel="prev"><span class="dir">← Older</span><span class="adj-title">{esc(prev_post["title"])}</span></a>'
        else:
            adjacent += '<span class="adjacent-link is-empty"></span>'
        if next_post:
            adjacent += f'<a class="adjacent-link is-next" href="/blog/{next_post["file"]}.html" rel="next"><span class="dir">Newer →</span><span class="adj-title">{esc(next_post["title"])}</span></a>'
        adjacent += "</nav>"

    html_out.append(f"""
<main class="main" id="main">
  <article class="essay">
    <header class="essay-header">
      <p class="eyebrow"><a href="/blog.html#archive" class="eyebrow-cat">{esc(post["category"])}</a><span class="dot">·</span><time datetime="{post["iso"]}">{post["date"]}</time></p>
      <h1 class="essay-title">{esc(post["title"])}</h1>
      {f'<p class="essay-subtitle">{esc(post["subtitle"])}</p>' if post["subtitle"] else ''}
      <p class="byline"><span class="byline-name">{esc(AUTHOR)}</span><span class="dot">·</span>{reading_time(post["words"])}<span class="dot">·</span><a href="{esc(post["canonical"])}">Originally on Substack</a></p>
    </header>
    {hero}
    <div class="essay-body" id="essay-body">
{content}
    </div>
    <footer class="essay-footer">
      <p class="colophon"><a href="{esc(post["canonical"])}">Originally published on Already Happened →</a></p>
      {adjacent}
      <section class="related" aria-label="Related essays">
        <h2 class="section-label">More in {esc(post["category"])}</h2>
        <div class="tile-grid">{rel_cards}</div>
      </section>
    </footer>
  </article>
</main>
""")
    html_out.append(FOOT)
    with open(os.path.join(BLOG_DIR, post["file"] + ".html"), "w") as f:
        f.write("".join(html_out))
    return toc


def main():
    posts = load_posts()
    slug_to_file = {p["slug"]: p["file"] for p in posts}
    build_index(posts)
    stats = []
    for i, p in enumerate(posts):
        toc = build_post(p, posts, i, slug_to_file)
        stats.append((p["file"], len(toc)))
    # remove generated files for posts that no longer exist
    wanted = {p["file"] + ".html" for p in posts}
    for name in os.listdir(BLOG_DIR):
        if name.endswith(".html") and name not in wanted and not name.startswith("_"):
            print("stale (not removed):", name)
    print(f"built blog.html and {len(posts)} posts; {sum(1 for _, n in stats if n >= 2)} with a table of contents")


if __name__ == "__main__":
    main()
