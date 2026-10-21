from __future__ import annotations

from app.services.pronunciation import apply_pronunciation, save_entries


def test_apply_pronunciation_whole_word(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.pronunciation.DICT_FILE", tmp_path / "pronunciation.json")
    save_entries({"API": "A P I", "Kokoro": "Ko ko ro"})
    assert apply_pronunciation("Call the API now") == "Call the A P I now"
    assert apply_pronunciation("api rocks") == "A P I rocks"
    assert "Ko ko ro" in apply_pronunciation("Thanks Kokoro")
