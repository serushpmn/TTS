from __future__ import annotations

from pathlib import Path
import os
import tempfile
import time


def create_temp_wav(*, prefix: str = "trim-", directory: str | os.PathLike[str] | None = None) -> Path:
    """Create an empty temp WAV path with the OS handle closed (required on Windows)."""
    fd, name = tempfile.mkstemp(suffix=".wav", prefix=prefix, dir=directory)
    os.close(fd)
    return Path(name)


def _is_in_use(exc: OSError) -> bool:
    winerror = getattr(exc, "winerror", None)
    if winerror in {32, 33}:  # sharing violation / lock violation
        return True
    return exc.errno in {13, 16, 11}  # EACCES, EBUSY, EAGAIN


def unlink_quietly(path: Path | None, *, attempts: int = 10, delay: float = 0.05) -> None:
    """Delete a file; retry Windows lock errors instead of failing the job."""
    if path is None:
        return
    for index in range(attempts):
        try:
            path.unlink(missing_ok=True)
            return
        except OSError as exc:
            if not _is_in_use(exc) or index == attempts - 1:
                if _is_in_use(exc):
                    return
                raise
            time.sleep(delay * (index + 1))
