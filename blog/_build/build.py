#!/usr/bin/env python3
"""Build the blog from the Substack cache.

  python3 blog/_build/fetch.py     # pull any new posts into blog/_build/raw/
  python3 blog/_build/build.py     # regenerate blog/<post>.html in the site design
  python3 blog/_build/home.py      # regenerate the beliefs on the home page

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


def wrap_cap(p):
    """Wrap the first letter (plus any opening quote) of paragraph p in <span class="cap">."""
    node, attr = p, "text"
    # descend into leading inline elements until we find real text
    while not (getattr(node, attr) or "").strip():
        if attr == "text" and len(node):
            node, attr = node[0], "text"
        else:
            return
    text = getattr(node, attr)
    m = re.match(r"^(\s*)([\"'\u2018\u201c\u00ab(\[]*[^\W_])", text)
    if not m:
        return
    lead, cap = m.group(1), m.group(2)
    rest = text[m.end():]
    span = LH.Element("span")
    span.set("class", "cap")
    span.text = cap
    span.tail = rest
    if attr == "text":
        node.text = lead
        node.insert(0, span)
    else:
        parent = node.getparent()
        node.tail = lead
        parent.insert(parent.index(node) + 1, span)


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
        if all_italic or text_of(child).startswith("("):   # asides like "(warning: long)" aren't the opening line
            child.set("class", "preamble")
            continue
        child.set("class", "lede")
        wrap_cap(child)
        break

    out = "".join(LH.tostring(c, encoding="unicode", method="html") for c in root)
    if root.text and root.text.strip():
        out = f"<p>{esc(root.text.strip())}</p>" + out
    return out, toc, hero_caption


# ----------------------------------------------------------------------------
# templates: essay pages in the site's natural/artificial design
# ----------------------------------------------------------------------------

FONTS = ("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400"
         "&family=JetBrains+Mono:wght@300;400&family=Marcellus"
         "&family=Newsreader:ital,opsz,wght@0,6..72,300..500;1,6..72,300..500&display=swap")

PAGE = """<!DOCTYPE html>
<html lang="en" data-world="{world}" data-default-world="{world}" data-state="chosen">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — {author}</title>
  <meta name="description" content="{description}">
  <meta property="og:title" content="{og_title}">
  <meta property="og:description" content="{description}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Stefan Kelly">
  <meta property="og:url" content="https://stefankelly.com/blog/{file}.html">
  <meta name="twitter:card" content="summary_large_image">
  {og_image}
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <script src="/boot.js?v=20261119202028"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="{fonts}" rel="stylesheet">
  <link rel="stylesheet" href="/site.css?v=20261119202028">
  <script defer src="/site.js?v=20261119202028"></script>
  <script defer src="/cf-analytics.js"></script>
</head>
<body class="page-essay">

<div class="frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>

<header class="mast">
  <p class="intro"><a href="/">Stefan Kelly</a></p>
</header>

<button class="switch" type="button" role="switch" aria-checked="false" aria-label="Show artificial minds">
  <span class="switch-label" data-side="natural">Human</span>
  <span class="switch-track"><span class="switch-knob"></span></span>
  <span class="switch-label" data-side="artificial">Artificial</span>
</button>

<main class="essay">
  <header class="essay-header">
    <p class="label"><time datetime="{iso}">{date}</time></p>
    <h1 class="essay-title">{title}</h1>
    {subtitle}
  </header>
  {hero}
  {media}
  <div class="essay-body">
{content}
  </div>
  <footer class="essay-foot">
    <a class="label" href="{canonical}">Originally on Already Happened</a>
    <a class="label" href="/">Back to the beliefs</a>
  </footer>
</main>

</body>
</html>
"""


def default_world(slug):
    """The world an essay opens in when the visitor hasn't chosen one:
    artificial if it only sits under artificial beliefs, otherwise natural."""
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location("home", os.path.join(HERE, "home.py"))
        home = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(home)
        worlds = {w for (w, _), slugs in home.ESSAYS.items() if slug in slugs}
    except Exception:
        worlds = set()
    return "artificial" if worlds == {"artificial"} else "natural"


def media_html(slug):
    """Audio player for podcast posts (the video stays on Substack)."""
    d = json.load(open(os.path.join(RAW, slug + ".json")))
    if not d.get("podcast_url"):
        return ""
    mins = round((d.get("podcast_duration") or 0) / 60)
    return (f'<figure class="essay-media"><audio controls preload="none" src="{esc(d["podcast_url"])}"></audio>'
            f'<figcaption class="label">{mins} min · <a href="{esc(d.get("canonical_url") or "")}">Watch on Substack</a></figcaption></figure>')


def build_post(post, slug_to_file):
    content, toc, hero_caption = clean_body(post["body_html"], post, slug_to_file)
    is_podcast = bool(json.load(open(os.path.join(RAW, post["slug"] + ".json"))).get("podcast_url"))
    hero = ""
    if post["cover"] and not is_podcast:
        hero = (f'<figure class="essay-hero"><img src="{esc(cdn(post["cover"], 1600))}" '
                f'srcset="{esc(cdn(post["cover"], 800))} 800w, {esc(cdn(post["cover"], 1600))} 1600w" '
                f'sizes="(max-width: 900px) 100vw, 900px" alt="" width="{post["cover_w"] or ""}" height="{post["cover_h"] or ""}">'
                + (f"<figcaption>{hero_caption}</figcaption>" if hero_caption else "") + "</figure>")
    out = PAGE.format(
        world=default_world(post["slug"]),
        title=esc(post["title"]),
        author=AUTHOR,
        description=esc(post["subtitle"] or f"An essay by {AUTHOR}."),
        og_title=esc(post["title"]),
        og_image=f'<meta property="og:image" content="{esc(cdn(post["cover"], 1200))}">' if post["cover"] else "",
        fonts=FONTS,
        iso=post["iso"],
        date=post["date"],
        subtitle=f'<p class="essay-subtitle">{esc(post["subtitle"])}</p>' if post["subtitle"] else "",
        hero=hero,
        media=media_html(post["slug"]),
        content=content,
        canonical=esc(post["canonical"]),
        file=post["file"],
    )
    with open(os.path.join(BLOG_DIR, post["file"] + ".html"), "w") as f:
        f.write(out)


REDIRECT = """<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Stefan Kelly</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<meta http-equiv="refresh" content="0; url=/"><link rel="canonical" href="/"></head>
<body><a href="/">Stefan Kelly</a></body></html>
"""


def main():
    posts = load_posts()
    slug_to_file = {p["slug"]: p["file"] for p in posts}
    for p in posts:
        build_post(p, slug_to_file)
    # the essays now live under the beliefs on the home page; the old index forwards there
    with open(os.path.join(ROOT, "blog.html"), "w") as f:
        f.write(REDIRECT)
    print(f"built {len(posts)} essay pages; blog.html now forwards to /")


if __name__ == "__main__":
    main()
