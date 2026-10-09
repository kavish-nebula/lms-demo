"""
Narration audio for the concept videos.

Reads the course sources in fixtures/src/ai-agent (each slide's `sentences`,
joined exactly as the build script joins them) and writes one MP3 per slide to
apps/web/public/audio/video-{id}-s{n}.mp3, the path the video player loads.
Video ids match the build: m{N}-{k} for lesson N.k, and ai-agent-intro for the
course preview. A manifest of text hashes means only new or changed narration
is synthesised again.

Needs Python 3.10+, internet access and edge-tts:  pip install edge-tts

Usage (from the repository root):
  python fixtures/scripts/make-audio.py            create missing or changed clips
  python fixtures/scripts/make-audio.py --only m3  only module 3's videos
  python fixtures/scripts/make-audio.py --force    re-create every clip
  python fixtures/scripts/make-audio.py --dry-run  list what would be created
"""

import argparse
import asyncio
import hashlib
import json
import re
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit("edge-tts is not installed. Run: pip install edge-tts")

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "fixtures" / "src" / "ai-agent"
OUT = ROOT / "apps" / "web" / "public" / "audio"
MANIFEST = SRC / "audio-manifest.json"

VOICE = "en-US-AndrewMultilingualNeural"
RATE = "+0%"
CONCURRENCY = 6
RETRIES = 4


def narration(slide) -> str:
    # same as the build script: sentences joined with single spaces
    return " ".join(slide.get("sentences", [])).strip()


def spoken(text: str) -> str:
    """A replay caption as the voice should say it: ids digit by digit, code names as words."""
    text = re.sub(r"(?:order\s+)?ORB-(\d+)", lambda m: "order " + " ".join(m.group(1)), text)
    text = re.sub(r"\bPP-(\d+)", lambda m: "P P " + " ".join(m.group(1)), text)
    text = re.sub(r"\b(\w+)_(\w+)\b", r"\1 \2", text)
    text = re.sub(r"\b401\b", "4 0 1", text)
    text = text.replace('""', "an empty string").replace("→", "returns")
    text = re.sub(r"(\w)@(\w+)\.com", r"\1 at \2 dot com", text)
    return text


def read(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        print(f"skipping {path.name}: not valid JSON yet ({err})")
        return None


def load_clips():
    """(file name, module, text) for every clip: the preview, each lesson video's
    slides, and for each module hook its opening narration (used when it has no
    film), each film scene's lines and each replay step's caption."""
    clips = []
    intro = SRC / "intro.json"
    if intro.exists() and (data := read(intro)):
        clips += [(f"video-ai-agent-intro-s{i}.mp3", "intro", narration(s)) for i, s in enumerate(data["slides"])]
    for mod_dir in sorted(SRC.glob("m[0-9]")):
        m = mod_dir.name
        for path in sorted(mod_dir.glob("video-*.json")):
            k = path.stem.removeprefix("video-").split(".")[1]  # "video-3.2" -> "2"
            if data := read(path):
                clips += [(f"video-{m}-{k}-s{i}.mp3", m, narration(s)) for i, s in enumerate(data.get("slides", []))]
        blocks = mod_dir / "blocks.json"
        if blocks.exists() and (data := read(blocks)) and data.get("hook"):
            hook = data["hook"]
            clips.append((f"hook-{m}-open.mp3", m, hook.get("narration", "").strip()))
            for i, shot in enumerate(hook.get("film", {}).get("shots", [])):
                clips.append((f"hook-{m}-s{i}.mp3", m, shot.get("say", "").strip()))
                if shot.get("then"):
                    clips.append((f"hook-{m}-s{i}-then.mp3", m, shot["then"].strip()))
            for k, step in enumerate(hook.get("reveal", {}).get("steps", [])):
                clips.append((f"hook-{m}-r{k}.mp3", m, spoken(step.get("caption", "")).strip()))
    return clips


def clip_hash(text: str) -> str:
    return hashlib.sha1(f"{VOICE}|{RATE}|{text}".encode("utf-8")).hexdigest()


async def synth(text: str, dest: Path, sem: asyncio.Semaphore) -> None:
    async with sem:
        for attempt in range(1, RETRIES + 1):
            try:
                tmp = dest.with_suffix(".part")
                await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(tmp))
                if tmp.stat().st_size < 1000:
                    raise RuntimeError("audio file came back nearly empty")
                tmp.replace(dest)
                return
            except Exception as err:  # network hiccups are common; back off and retry
                if attempt == RETRIES:
                    raise RuntimeError(f"{dest.name}: {err}") from err
                await asyncio.sleep(2 * attempt)


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="module id, e.g. m3, or 'intro'")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}

    jobs = []
    for name, module, text in load_clips():
        if (args.only and module != args.only) or not text:
            continue
        dest = OUT / name
        h = clip_hash(text)
        if args.force or not dest.exists() or manifest.get(name) != h:
            jobs.append((name, text, dest, h))

    print(f"{len(jobs)} clip(s) to create, voice {VOICE}", flush=True)
    if args.dry_run or not jobs:
        for name, *_ in jobs:
            print("  ", name)
        return

    sem = asyncio.Semaphore(CONCURRENCY)
    done = 0
    failed = []
    made = {}

    async def run(job):
        nonlocal done
        name, text, dest, h = job
        try:
            await synth(text, dest, sem)
            made[name] = h
        except Exception as err:
            failed.append(str(err))
        done += 1
        if done % 10 == 0 or done == len(jobs):
            print(f"  {done}/{len(jobs)}", flush=True)

    await asyncio.gather(*(run(j) for j in jobs))
    # re-read before writing, so runs for different modules at the same time don't drop each other's entries
    latest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    latest.update(made)
    MANIFEST.write_text(json.dumps(dict(sorted(latest.items())), indent=1) + "\n", encoding="utf-8")

    if failed:
        print(f"{len(failed)} clip(s) failed:")
        for f in failed:
            print("  ", f)
        sys.exit(1)
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
