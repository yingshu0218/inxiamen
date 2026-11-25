"""Render the 787 cabin instrumentals from the game's arrangements.

Uses NumPy and FFmpeg. The Salamander Grand Piano samples are by Alexander
Holm (CC BY 3.0); Meta Steel Guitar is CC0. Only the mixes ship in the game.
"""

import argparse
import subprocess
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

from cabin_scores import SCORES, arrange

RATE = 32000
BEAT = 60 / 118
SAMPLES = "https://raw.githubusercontent.com/Tonejs/audio/869b6f8d9cddb47d966238c012041480b1ce517a/salamander"
GUITAR = ("https://raw.githubusercontent.com/facebookincubator/Meta-open-sound/"
          "514c926efecdb3c7812bf00eedf8e5c8d61dd681/systems/instruments/meta-steel-guitar/ogg")
OUTPUT = Path(__file__).resolve().parents[1] / "public/audio"
CLASSIC = "dimanche-et-fetes"

# One bar per row. Each pair gives the sixteenth-note position and MIDI pitch.
motif = [(0, 77), (2, 86), (4, 84), (5, 86)]
answer = [(0, 77), (2, 84), (4, 82), (5, 84)]
theme = [
    motif, motif, motif + [(8, 86), (10, 87), (12, 86), (13, 87)],
    [(0, 86), (2, 84), (4, 82), (6, 82), (8, 84)],
    answer, answer, [(0, 84), (2, 84), (4, 84), (5, 86), (8, 84), (10, 84), (12, 84), (13, 86)],
    [(0, 84), (2, 82), (4, 81), (6, 79), (8, 81), (9, 82)],
]
middle = [
    [(0, 77), (2, 79), (4, 81), (5, 82), (8, 82), (10, 82), (12, 82), (13, 84)],
    [(0, 82), (2, 82), (4, 82), (5, 84), (8, 82), (10, 82), (12, 82), (14, 81), (15, 79)],
    [(0, 77), (2, 81), (4, 81), (6, 81), (8, 81), (9, 82), (12, 81), (14, 81)],
    [(0, 81), (1, 82), (4, 81), (6, 81), (8, 81), (10, 79), (11, 77), (12, 75), (13, 77), (14, 79)],
    [(0, 79), (2, 79), (4, 79), (5, 81), (8, 79), (10, 79), (12, 79), (13, 81)],
    [(0, 79), (2, 77), (4, 75), (5, 74)],
    [(0, 74), (2, 75), (4, 77), (5, 72), (8, 77)],
]
chords = {
    "Bb": (46, 53, 58, 62), "Gm": (43, 53, 58, 62), "Eb": (39, 51, 55, 62),
    "F": (41, 53, 57, 60), "Dm": (38, 53, 57, 62), "Cm": (48, 55, 58, 63),
    "F7": (41, 51, 57, 60),
}
theme_chords = ["Bb", "Gm", "Eb", "F", "F", "Dm", "Cm", "F7"]


def score():
    bars = [[]] + theme + theme + middle + theme + [motif, [(0, 82)]]
    harmony = ["Bb"] + theme_chords * 2 + ["Bb", "Bb", "F", "F7", "Eb", "Bb", "F7"] + theme_chords + ["Gm", "Bb"]
    events = []
    for bar, (line, chord) in enumerate(zip(bars, harmony, strict=True)):
        bass, fifth, third, top = chords[chord]
        start = .09 + bar * 4 * BEAT
        final = bar == len(bars) - 1
        pattern = [(0, bass, 1.4, .55), (.52, fifth, .8, .29), (1.0, third, .8, .32),
                   (1.5, top, .75, .33), (2.0, fifth, 1.0, .42), (2.52, top, .72, .29),
                   (3.0, third, .75, .30), (3.52, fifth, .52, .25)]
        if final:
            pattern = [(i * .06, p, 3.8, .44 - i * .035) for i, p in enumerate((bass, fifth, third, top))]
        for beat, pitch, hold, strength in pattern:
            events.append((start + beat * BEAT, pitch, hold * BEAT, strength))
        for i, (step, pitch) in enumerate(line):
            next_step = line[i + 1][0] if i + 1 < len(line) else 16
            hold = (next_step - step) * BEAT / 4
            strength = (.80 if step % 4 == 0 else .72) * (.90 if bar > 24 else 1)
            events.append((start + step * BEAT / 4, pitch, hold if final else min(.83, hold * .87), strength))
    return events


def sample(cache, key, guitar):
    if guitar:
        strings = [(40, "LowE"), (45, "A"), (50, "D"), (55, "G"), (59, "B"), (64, "HighE")]
        string = max(pair for pair in strings if pair[0] <= key)[1]
        note = ("C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B")[key % 12]
        name = f"INSGuitarSteel_String{string}_Vel02_{note}{key // 12 - 1}_01.ogg"
        url = f"{GUITAR}/{name}"
    else:
        name = ("C", "Ds", "Fs", "A")[(key % 12) // 3] + str(key // 12 - 1) + ".mp3"
        url = f"{SAMPLES}/{name}"
    path = cache / name
    if not path.exists():
        with urllib.request.urlopen(url, timeout=40) as response:
            path.write_bytes(response.read())
    raw = subprocess.check_output(["ffmpeg", "-loglevel", "error", "-i", str(path), "-ar", str(RATE),
                                   "-ac", "2", "-f", "f32le", "-"])
    return key, np.frombuffer(raw, dtype="<f4").reshape(-1, 2)


def render(cache, track):
    cache.mkdir(parents=True, exist_ok=True)
    if track == CLASSIC:
        title, author, guitar, events = "Dimanche et fêtes", "Paul de Senneville", False, score()
    else:
        title, author, style, bpm, bars, harmony = SCORES[track]
        guitar = style == "guitar"
        events = arrange(bpm, bars, harmony, style)
    keys = {p: p if guitar else round(p / 3) * 3 for _, p, _, _ in events}
    with ThreadPoolExecutor(6) as pool:
        samples = dict(pool.map(lambda key: sample(cache, key, guitar), sorted(set(keys.values()))))
    duration = max(start + hold for start, _, hold, _ in events) + 1.8
    mix = np.zeros((int(duration * RATE), 2), np.float32)
    rng = np.random.default_rng(787)
    for start, pitch, hold, strength in events:
        key = keys[pitch]
        sample_data = samples[key]
        release = .22 if hold < .2 else .34
        time = np.arange(round(RATE * (hold + release * 4))) / RATE
        offset = time * RATE * 2 ** ((pitch - key) / 12)
        envelope = np.exp(-np.maximum(time - hold, 0) / (release * .52))
        gain = strength ** 1.6 * rng.uniform(.96, 1.04)
        pos = int((start + rng.uniform(-.007, .007)) * RATE)
        for channel in range(2):
            tone = np.interp(offset, np.arange(len(sample_data)), sample_data[:, channel], right=0)
            mix[pos:pos + len(time), channel] += tone * envelope * gain
    # Quiet, alternating early reflections keep the piano present over the engine.
    room = mix.copy()
    for seconds, gain in ((.039, .105), (.068, .072), (.101, .045), (.157, .026)):
        delay = int(seconds * RATE)
        room[delay:] += mix[:-delay, ::-1] * gain
    room *= .86 / np.max(np.abs(room))
    OUTPUT.mkdir(exist_ok=True)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(RATE), "-ac", "2",
                    "-i", "-", "-c:a", "libmp3lame", "-q:a", "3", "-metadata", f"title={title}",
                    "-metadata", f"composer={author}", str(OUTPUT / (track + ".mp3"))], input=room.tobytes(), check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", required=True, type=Path)
    parser.add_argument("--tracks", nargs="+", choices=[CLASSIC, *SCORES], default=[CLASSIC, *SCORES])
    args = parser.parse_args()
    for track in args.tracks:
        render(args.cache, track)
