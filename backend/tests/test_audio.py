import wave
from pathlib import Path

from app.audio.concatenate import concatenate_wavs
from app.audio.tempfiles import create_temp_wav, unlink_quietly


def create_wav(path: Path) -> None:
    with wave.open(str(path), "wb") as file:
        file.setparams((1, 2, 100, 0, "NONE", "not compressed"))
        file.writeframes(b"\x00\x00" * 10)


def test_pause_is_written(tmp_path: Path):
    first, second, target = tmp_path / "1.wav", tmp_path / "2.wav", tmp_path / "out.wav"
    create_wav(first); create_wav(second)
    concatenate_wavs([(first, 2.5), (second, 0)], target)
    with wave.open(str(target)) as result:
        assert result.getnframes() == 270


def test_temp_wav_handle_is_closed_so_unlink_works(tmp_path: Path):
    path = create_temp_wav(prefix="trim-", directory=tmp_path)
    assert path.exists()
    path.write_bytes(b"x")
    unlink_quietly(path)
    assert not path.exists()


def test_concatenate_trim_silence_succeeds(tmp_path: Path):
    first, second, target = tmp_path / "1.wav", tmp_path / "2.wav", tmp_path / "out.wav"
    create_wav(first)
    create_wav(second)
    concatenate_wavs([(first, 0.1), (second, 0)], target, trim_silence=True)
    assert target.exists()
    with wave.open(str(target), "rb") as result:
        assert result.getnframes() > 0

