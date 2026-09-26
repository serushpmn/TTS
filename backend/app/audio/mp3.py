from __future__ import annotations

from pathlib import Path
import wave


def wav_to_mp3(wav_path: Path, mp3_path: Path, bitrate: int = 192) -> Path:
    """Encode a PCM WAV file to MP3 using lameenc (no FFmpeg required)."""
    try:
        import lameenc
    except ImportError as error:
        raise RuntimeError(
            "MP3 support requires lameenc. Run: .\\.venv\\Scripts\\python.exe -m pip install lameenc"
        ) from error

    with wave.open(str(wav_path), "rb") as wav:
        channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        sample_rate = wav.getframerate()
        pcm = wav.readframes(wav.getnframes())

    if sample_width != 2:
        raise ValueError("Only 16-bit PCM WAV can be converted to MP3.")

    encoder = lameenc.Encoder()
    encoder.set_bit_rate(bitrate)
    encoder.set_in_sample_rate(sample_rate)
    encoder.set_channels(channels)
    encoder.set_quality(2)
    mp3_path.write_bytes(encoder.encode(pcm) + encoder.flush())
    return mp3_path
