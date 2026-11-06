"""Piper cache and the missing-binary fallback.

Behaviour: audio_for writes one wav per spoken line and returns None when Piper is absent.
Module: app.voice.piper. No existing test covers it.
"""

from __future__ import annotations

import app.voice.piper as piper


def test_missing_piper_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr(piper.config, "PIPER_BIN", str(tmp_path / "missing-piper"))
    monkeypatch.setattr(piper.config, "AUDIO_DIR", tmp_path / "audio")
    assert piper.audio_for("Qb8+ gives check.") is None


def test_same_sentence_reuses_one_file(tmp_path, monkeypatch):
    hits = tmp_path / "hits"
    binary = tmp_path / "piper"
    binary.write_text(
        "#!/bin/sh\n"
        "cat >/dev/null\n"
        "out=\n"
        "while [ $# -gt 0 ]; do\n"
        "  if [ \"$1\" = \"--output_file\" ]; then out=\"$2\"; fi\n"
        "  shift\n"
        "done\n"
        "printf RIFF > \"$out\"\n"
        f"echo x >> {hits}\n"
    )
    binary.chmod(0o755)
    audio = tmp_path / "audio"
    monkeypatch.setattr(piper.config, "PIPER_BIN", str(binary))
    monkeypatch.setattr(piper.config, "AUDIO_DIR", audio)
    monkeypatch.setattr(piper.config, "PIPER_MODEL", "test-voice")
    monkeypatch.setattr(piper.config, "PIPER_MODEL_PATH", "")
    monkeypatch.setattr(piper.config, "PIPER_TIMEOUT_S", 5)

    first = piper.audio_for("Qb8+ gives check.")
    second = piper.audio_for("Qb8+ gives check.")
    assert first == second
    assert first is not None and first.startswith("/audio/") and first.endswith(".wav")
    assert len(list(audio.glob("*.wav"))) == 1
    assert hits.read_text().count("x") == 1
