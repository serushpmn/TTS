from __future__ import annotations

from pathlib import Path
import tempfile
import wave

import numpy as np

from app.audio.trim import trim_wav_silence


def concatenate_wavs(
    items: list[tuple[Path, float]],
    destination: Path,
    *,
    trim_silence: bool = False,
) -> None:
    """Append PCM wave files and intentional silences without FFmpeg."""
    if not items:
        raise ValueError("There are no audio segments to combine.")
    prepared: list[tuple[Path, float]] = []
    temp_files: list[Path] = []
    try:
        for source, pause_after in items:
            path = source
            if trim_silence:
                tmp = Path(tempfile.mkstemp(suffix=".wav", prefix="trim-")[1])
                temp_files.append(tmp)
                path = trim_wav_silence(source, tmp)
            prepared.append((path, pause_after))

        with wave.open(str(prepared[0][0]), "rb") as first:
            channels, width, rate = first.getnchannels(), first.getsampwidth(), first.getframerate()
        with wave.open(str(destination), "wb") as output:
            output.setparams((channels, width, rate, 0, "NONE", "not compressed"))
            for source, pause_after in prepared:
                with wave.open(str(source), "rb") as input_file:
                    if (input_file.getnchannels(), input_file.getsampwidth(), input_file.getframerate()) != (
                        channels,
                        width,
                        rate,
                    ):
                        raise ValueError("Audio segments use incompatible WAV formats.")
                    output.writeframes(input_file.readframes(input_file.getnframes()))
                if pause_after:
                    output.writeframes(np.zeros(int(rate * pause_after * channels), dtype=np.int16).tobytes())
    finally:
        for path in temp_files:
            path.unlink(missing_ok=True)
