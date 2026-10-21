"""Generate pre-baked voice sample WAVs into data/voice_samples/."""

from __future__ import annotations

import sys

from app.services.prefs import selected_model_id
from app.services.voice_samples import ensure_sample
from app.tts.voices import list_voices


def main() -> None:
    force = "--force" in sys.argv
    model_id = selected_model_id()
    voices = list_voices()
    print(f"Baking {len(voices)} samples with model={model_id} force={force}")
    for voice in voices:
        try:
            path = ensure_sample(voice.id, model_id=model_id, force=force)
            print("OK", voice.id, path)
        except Exception as error:  # noqa: BLE001
            print("FAIL", voice.id, error)


if __name__ == "__main__":
    main()
