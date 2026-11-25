"""Render the game's Mandarin/English announcements with offline MeloTTS.

Requires NumPy, sherpa-onnx, and FFmpeg, plus the unpacked vits-melo-tts-zh_en
and vits-melo-tts-en models. No TTS runs in the browser.
"""

import argparse
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import sherpa_onnx

OUTPUT = Path(__file__).resolve().parents[1] / "public/audio"
ANNOUNCEMENTS = {
    "pa-descent": (
        "开始下降",
        "女士们，先生们，我们的航班已经开始下降，准备在厦门高崎国际机场着陆。请您回到座位，系好安全带。",
        "Ladies and gentlemen, we are now descending into Xiamen. Please return to your seat and fasten your seat belt.",
    ),
    "pa-city": (
        "杏林湾观景",
        "各位旅客，飞机正经过杏林湾西侧。从左侧舷窗望去，海湾对岸就是厦门本岛。",
        "We are now passing Xinglin Bay. From the windows on your left, you can see Xiamen Island across the water.",
    ),
    "pa-landing": (
        "着陆准备",
        "各位旅客，飞机即将在厦门高崎机场着陆。请系好安全带，收起小桌板，调直座椅靠背。",
        "We will be landing shortly. Please fasten your seat belt, stow your tray table, and return your seat back to the upright position.",
    ),
    "pa-welcome": (
        "欢迎抵达厦门",
        "女士们，先生们，欢迎来到厦门。请保持就座，系好安全带。人生路漫漫，白鹭常相伴。感谢您乘坐厦门航空。",
        "Ladies and gentlemen, welcome to Xiamen. Please remain seated with your seat belt fastened. Thank you for flying with Xiamen Air.",
    ),
}


def cabin_chime(rate):
    audio = np.zeros(round(1.22 * rate), dtype=np.float32)
    for start, frequency in [(0.06, 698.46), (.42, 523.25)]:
        t = np.arange(round(.72 * rate)) / rate
        tone = np.sin(2 * np.pi * frequency * t) + .14 * np.sin(4 * np.pi * frequency * t)
        envelope = (1 - np.exp(-t / .012)) * np.exp(-t / .17) * np.minimum(1, (.72 - t) / .08)
        first = round(start * rate)
        audio[first:first + len(t)] += .235 * tone * envelope
    return audio


def spoken_line(tts, text, speed):
    audio = tts.generate(text, sid=0, speed=speed)
    samples = np.asarray(audio.samples, dtype=np.float32)
    rate = audio.sample_rate
    active = np.flatnonzero(np.abs(samples) > .006)
    if not len(active):
        raise ValueError(f"Empty speech: {text}")
    samples = samples[max(0, active[0] - rate // 20):active[-1] + rate // 12]
    # Match the loudness of the two readings before adding the intercom chime.
    voiced = samples[np.abs(samples) > .025]
    return samples * (.16 / np.sqrt(np.mean(voiced ** 2)))


def make_voice(model_dir, lexicon):
    dictionary = model_dir / "dict"
    rules = model_dir / "new_heteronym.fst"
    vits = sherpa_onnx.OfflineTtsVitsModelConfig(
        model=str(model_dir / "model.onnx"), lexicon=str(lexicon), tokens=str(model_dir / "tokens.txt"),
        dict_dir=str(dictionary) if dictionary.is_dir() else "",
    )
    model = sherpa_onnx.OfflineTtsModelConfig(vits=vits, num_threads=4)
    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=model, rule_fsts=str(rules) if rules.is_file() else ""))


def english_voice(model_dir):
    # The default US dictionary gives Xiamen three syllables and omits Xinglin.
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8") as lexicon:
        for line in (model_dir / "lexicon.txt").read_text().splitlines():
            if line.split(" ", 1)[0] not in {"xiamen", "xinglin"}:
                lexicon.write(line + "\n")
        lexicon.write("xiamen sh y aa m eh n 7 7 9 7 10 7\nxinglin sh ih ng l ih n 7 9 7 7 10 7\n")
        lexicon.flush()
        return make_voice(model_dir, lexicon.name)


def render(chinese_model, english_model):
    chinese = make_voice(chinese_model, chinese_model / "lexicon.txt")
    english = english_voice(english_model)
    rate = chinese.sample_rate
    if english.sample_rate != rate:
        raise ValueError("The two MeloTTS voices must use the same sample rate.")
    chime = cabin_chime(rate)
    pause = np.zeros(round(.68 * rate), dtype=np.float32)
    OUTPUT.mkdir(exist_ok=True)
    for key, (title, mandarin_text, english_text) in ANNOUNCEMENTS.items():
        programme = np.concatenate([chime, spoken_line(chinese, mandarin_text, .90), pause,
                                    spoken_line(english, english_text, .94)])
        subprocess.run([
            "ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(rate), "-ac", "1", "-i", "-",
            "-af", "highpass=f=145,lowpass=f=5600,acompressor=threshold=0.24:ratio=2.2:attack=12:release=110,"
                   "loudnorm=I=-17:TP=-1.6:LRA=8",
            "-ar", "32000", "-c:a", "libmp3lame", "-b:a", "80k", "-metadata", f"title={title}",
            str(OUTPUT / (key + ".mp3")),
        ], input=programme.astype("<f4").tobytes(), check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chinese-model", type=Path, required=True)
    parser.add_argument("--english-model", type=Path, required=True)
    args = parser.parse_args()
    render(args.chinese_model, args.english_model)
