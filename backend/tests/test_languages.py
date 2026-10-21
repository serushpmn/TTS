from __future__ import annotations

from app.tts.languages import get_language, list_languages, resolve_lang_for_voice


def test_list_includes_german():
    ids = {item["id"] for item in list_languages()}
    assert "en-us" in ids
    assert "de" in ids


def test_german_is_torch_experimental():
    de = get_language("de")
    assert de.status == "experimental"
    assert de.engine == "torch"


def test_resolve_auto_from_voice():
    assert resolve_lang_for_voice("bf_emma", None).id == "en-gb"
    assert resolve_lang_for_voice("af_heart", "auto").id == "en-us"


def test_list_includes_auto():
    assert list_languages()[0]["id"] == "auto"
