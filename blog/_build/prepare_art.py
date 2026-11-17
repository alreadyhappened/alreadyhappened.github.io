"""Turn Midjourney downloads into the site's art files.

    python3 blog/_build/prepare_art.py <folder with the downloaded PNGs>

Each PNG named like `belief-2-natural.png` is resized and saved as webp next to
this script, under the same name.

Images that swap with the natural/artificial switch (hero, plate, foot, cabinet)
must line up exactly, so the dark version is made first and the light one is
made from it in Midjourney: attach the dark image to the prompt and ask for the
same composition re-made in daylight materials. Don't generate the two
separately, and don't colour-invert one.
"""
import pathlib
import sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent.parent.parent / "art"
MAX_SIDE = 1600


def main(src):
    for png in sorted(pathlib.Path(src).glob("*.png")):
        name = png.stem.removeprefix("mj-")
        img = Image.open(png).convert("RGB")
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        path = HERE / f"{name}.webp"
        img.save(path, "WEBP", quality=86, method=6)
        print(f"  {path.name}  {img.size[0]}x{img.size[1]}  {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
