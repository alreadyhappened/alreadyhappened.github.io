"""Build the beliefs section of next/index.html.

Each belief is a statement, an image slot, and the essays that sit behind it.
Essays come from the Substack archive. Anything not listed is left off the site.

Run from the repo root:  python3 blog/_build/home.py
"""
import datetime
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

# Statements are the author's words. Each is read after a small "I believe that".
BELIEFS = {
    "natural": [
        "true human desire arises from a need to feel whole.",
        "humans are consistently influenced unconsciously.",
        "across history we vary in conscious experience, and the sources we derive meaning from (and that this is expressed in the output of that time).",
        "the contents of human minds/unconscious minds can be read in the grand scheme, not at an individual level.",
        "we aren’t sure how AI use is affecting humans.",
        "good policy empowers individuals.",
        "we don’t know how to interact with alien minds.",
        "science doesn’t fit psychology perfectly.",
        "most people do not care about superintelligence.",
        "people will not be prepared for AI.",
    ],
    "artificial": [
        "LLMs cannot desire for desire’s sake.",
        "AI could very easily influence humans unconsciously.",
        "AI would not require consciousness to have an unconscious.",
        "agents in swarms may be better mapped as a single mind.",
        "we may be able to read artificial minds.",
    ],
}

# The essays behind each belief, placed after reading every essay in full.
# Every belief is judged on its own. An essay is listed only where the belief is
# central to what it argues; it can sit behind more than one; and a belief with
# nothing written directly on it yet stays empty. The "AGI and the Infinite" chapter
# posts are the ghost stories essay split up, so the chapters are listed, not the full essay.
ESSAYS = {
    ("natural", 1): [  # desire arises from a need to feel whole
        "she-said-i-want-something-that-i",        # argues it outright: the mirror stage, the void, "for the very first time, you desired"
        "desire-as-a-responsibility",              # his fullest account of desire and why it goes missing
    ],
    ("natural", 2): [  # humans are consistently influenced unconsciously
        "what-corecore-was-actually-about",        # motivation precedes cognition; answers built unconsciously
        "inertia-with-a-capital-i",                # hidden self-serving motives that protect the status quo
        "the-for-you-everything",                  # preferences and identity supplied by the system
        "how-to-learn-about-people-in-art",        # positive power: you think aligning with it was your idea
        "someone-else-was-in-the-room-where",      # the Other as an invisible presence shaping desire and action
        "what-is-the-white-lotus-for",             # audiences steered by what they want to hear
        "priced-in-self-sabotage-edition",         # mistaking your unconscious for the outside world
        "if-its-on-tv-its-a-tv-show",              # the informed as prime propaganda territory
        "everythings-going-exactly-as-expected",   # unconsciously arranging the outcome you claim not to want
        "theres-something-alive-down-there",       # chapter 2 of AGI and the Infinite: a direct defence that the unconscious is real
    ],
    ("natural", 3): [  # conscious experience and sources of meaning vary across history
        "a-potted-history-of-variation-in",        # chapter 4 of AGI and the Infinite: the belief stated outright - Jaynes, Athens, the Renaissance
        "how-to-keep-the-infinite-at-bay",         # chapter 3: why this era experiences differently
        "the-renaissance-did-not-take-place",      # takes differences across periods as real, and readable
        "the-future-of-psychology-w-dario",        # conversation with Dario Krpan: "humans aren't constant", positivism vs the inner world
        "agi-and-the-infinite-part-i",             # chapter 1: what past eras built and why
        "love-island-uk-s12-e47-is-a-totally",     # Greek tragedy then, a hero of nihilism now
        "the-semiotics-of-spiking-someones",       # from Guilty Man to Tragic Man
        "youre-even-more-on-your-own-from",        # generations differ because their technology does
        "theres-a-reasonable-chance-that-youre",   # loss aversion as a product of a culture, not of humans
        "priced-in-the-collapse-of-conscientiousness",  # a population's personality shifting over time
        "why-did-slavoj-zizek-write-copy-for",     # how truth is received changes with the medium
    ],
    ("natural", 4): [  # minds can be read in the grand scheme, not individually
        "the-renaissance-did-not-take-place",      # why patterns are legible at the level of an era and vanish at the level of individuals
        "culture-is-a-system",                     # desire read from aggregate behaviour, not self-report
        "cultural-moloch",                         # the same argument, condensed
        "who-burned-down-the-shoreditch-cereal",   # a culture as one algorithm whose contents are its stories
        "what-is-the-white-lotus-for",             # a collective wish read off what a mass audience embraces
        "hyper-hypotheticals-in-psychological",    # populations can be modelled; the individual twin cannot
        "priced-in-the-collapse-of-conscientiousness",  # traits legible in aggregate, undefined in a person
    ],
    ("natural", 5): ["please-stop-using-that-mit-cognitive"],
    ("natural", 6): ["on-groups-and-individuals"],
    ("natural", 7): ["ai-agents-have-a-trust-value-complexity"],
    ("natural", 8): ["priced-in-replication-and-replicants"],
    ("natural", 9): ["agi-isnt-for-happy-people"],
    ("natural", 10): ["why-making-up-for-lost-time-is-hard"],
    ("artificial", 1): [  # LLMs cannot desire for desire's sake
        "synthetic-men-cant-jump",                 # LLMs can't make the creative jump; that may need an experience of being
    ],
    ("artificial", 2): [  # AI could very easily influence humans unconsciously
        "the-things-you-dont-want-to-know",        # sycophancy people only objected to once they could see it
        "the-status-quo-is-dead-long-live",        # personalised AI changing people without their noticing
    ],
    ("artificial", 3): [  # AI would not require consciousness to have an unconscious
        "how-to-move-two-goalposts-at-the",        # repression in models, argued without settling consciousness
        "a-natural-development-cannot-be-halted",  # direction and goals operating without conscious deliberation, in machines too
    ],
    ("artificial", 4): [  # agents in swarms may be better mapped as a single mind
        "a-natural-development-cannot-be-halted",  # agents on a message board sacrificing themselves for the collective
    ],
    ("artificial", 5): [  # we may be able to read artificial minds
        "how-to-move-two-goalposts-at-the",        # deception features revealing what a model holds under its answer
    ],
}

ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"]


def cover(url, width=640):
    """Ask the Substack CDN for a sensibly sized cover."""
    return re.sub(r"(\$s_![^!]+!,)", rf"\1w_{width},c_limit,", url or "", count=1)


def piece(p, files):
    date = datetime.datetime.fromisoformat(p["post_date"].replace("Z", "+00:00")).strftime("%b %Y")
    if p.get("type") == "podcast":
        date = f"Conversation · {date}"
    return (
        f'        <a class="piece" href="/blog/{files.get(p["slug"], p["slug"])}.html">'
        f'<span class="piece-img"><img loading="lazy" src="{html.escape(cover(p.get("cover_image")))}" alt=""></span>'
        f'<span class="piece-body"><span class="label">{date}</span>'
        f'<span class="piece-title">{html.escape(p["title"])}</span></span></a>'
    )


def main():
    archive = json.loads((ROOT / "blog/_build/archive.json").read_text())
    files = json.loads((ROOT / "blog/_build/posts.json").read_text())["files"]
    archive.sort(key=lambda p: p["post_date"], reverse=True)
    by_slug = {p["slug"]: p for p in archive}
    placed = {slug for slugs in ESSAYS.values() for slug in slugs}
    missing = sorted(placed - set(by_slug))
    if missing:
        raise SystemExit(f"Unknown slugs in ESSAYS: {missing}")

    out = []
    for world in ("natural", "artificial"):
        for i, text in enumerate(BELIEFS[world]):
            n = i + 1
            mine = [by_slug[slug] for slug in ESSAYS.get((world, n), [])]
            pieces = ""
            if mine:
                pieces = ('\n      <div class="belief-why">\n        <p class="label">Why I believe that</p>\n'
                          '        <div class="why-strip">\n' + "\n".join(piece(p, files) for p in mine) + "\n        </div>\n      </div>")
            out.append(
                f'    <article class="belief" data-in="{world}">\n'
                f'      <div class="belief-head">\n'
                f'        <figure class="plate belief-art" data-art="belief-{n}" data-art-world="{world}">'
                f'<div class="sigil" data-sigil="belief {world} {n}"></div></figure>\n'
                f'        <div class="belief-body"><p class="label">I believe that</p>'
                f'<p class="belief-text">{html.escape(text, quote=False)}</p></div>\n'
                f"      </div>{pieces}\n"
                f"    </article>"
            )

    page = ROOT / "index.html"
    doc = page.read_text()
    doc, count = re.subn(
        r"(<!--BELIEFS:START-->\n).*?(<!--BELIEFS:END-->)",
        lambda m: m.group(1) + "\n".join(out) + "\n" + m.group(2),
        doc,
        flags=re.S,
    )
    if count != 1:
        raise SystemExit("BELIEFS markers not found in index.html")
    page.write_text(doc)
    print(f"wrote {len(out)} beliefs; {len(placed)} essays placed; {len(archive) - len(placed)} not on the page")


if __name__ == "__main__":
    main()
