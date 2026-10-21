from __future__ import annotations

from pathlib import Path

from app.tts.model_manager import ModelManager
from app.tts.registry import TORCH_ENGINE_ID


def test_torch_always_installed(tmp_path, monkeypatch):
    manager = ModelManager()
    monkeypatch.setattr(manager, "models_dir", tmp_path / "models")
    monkeypatch.setattr(manager, "voices_dir", tmp_path / "voices")
    manager.models_dir.mkdir()
    manager.voices_dir.mkdir()
    assert manager.is_installed(TORCH_ENGINE_ID) is True


def test_onnx_not_installed_until_file_present(tmp_path, monkeypatch):
    manager = ModelManager()
    monkeypatch.setattr(manager, "models_dir", tmp_path / "models")
    monkeypatch.setattr(manager, "voices_dir", tmp_path / "voices")
    manager.models_dir.mkdir()
    manager.voices_dir.mkdir()
    assert manager.is_installed("model_q8f16") is False
    fake = manager.model_path("model_q8f16")
    fake.write_bytes(b"x" * 2_000_000)
    assert manager.is_installed("model_q8f16") is True


def test_delete_model_resets_selection(tmp_path, monkeypatch):
    from app.services import prefs as prefs_mod

    monkeypatch.setattr(prefs_mod, "PREFS_FILE", tmp_path / "prefs.json")
    manager = ModelManager()
    monkeypatch.setattr(manager, "models_dir", tmp_path / "models")
    monkeypatch.setattr(manager, "voices_dir", tmp_path / "voices")
    manager.models_dir.mkdir()
    manager.voices_dir.mkdir()
    path = manager.model_path("model_q8f16")
    path.write_bytes(b"x" * 2_000_000)
    manager.select_model("model_q8f16")
    assert prefs_mod.selected_model_id() == "model_q8f16"
    manager.delete_model("model_q8f16")
    assert not path.exists()
    assert prefs_mod.selected_model_id() == TORCH_ENGINE_ID


def test_verify_checksum(tmp_path, monkeypatch):
    manager = ModelManager()
    path = tmp_path / "f.bin"
    path.write_bytes(b"hello-world" * 200_000)
    status = manager._verify_file(path, expected_bytes=path.stat().st_size, sha256="deadbeef")
    assert status == "checksum_failed"
