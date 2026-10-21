from __future__ import annotations

import pytest

from app.services import prefs as prefs_mod
from app.tts.registry import TORCH_ENGINE_ID


def test_prefs_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(prefs_mod, "PREFS_FILE", tmp_path / "prefs.json")
    prefs_mod.save_prefs({"selected_model_id": "model_q8f16"})
    assert prefs_mod.selected_model_id() == "model_q8f16"
    prefs_mod.save_prefs({"selected_model_id": TORCH_ENGINE_ID})
    assert prefs_mod.selected_model_id() == TORCH_ENGINE_ID


def test_prefs_reject_unknown(tmp_path, monkeypatch):
    monkeypatch.setattr(prefs_mod, "PREFS_FILE", tmp_path / "prefs.json")
    with pytest.raises(ValueError):
        prefs_mod.save_prefs({"selected_model_id": "not-a-model"})
