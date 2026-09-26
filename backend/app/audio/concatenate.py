from __future__ import annotations

from pathlib import Path
import wave

import numpy as np


def concatenate_wavs(items: list[tuple[Path, float]], destination: Path) -> None:
    """Append PCM wave files and intentional silences without FFmpeg."""
    if not items:
        raise ValueError("There are no audio segments to combine.")
    with wave.open(str(items[0][0]), "rb") as first:
        channels, width, rate = first.getnchannels(), first.getsampwidth(), first.getframerate()
    with wave.open(str(destination), "wb") as output:
        output.setparams((channels, width, rate, 0, "NONE", "not compressed"))
        for source, pause_after in items:
            with wave.open(str(source), "rb") as input_file:
                if (input_file.getnchannels(), input_file.getsampwidth(), input_file.getframerate()) != (channels, width, rate):
                    raise ValueError("Audio segments use incompatible WAV formats.")
                output.writeframes(input_file.readframes(input_file.getnframes()))
            if pause_after:
                output.writeframes(np.zeros(int(rate * pause_after * channels), dtype=np.int16).tobytes())
