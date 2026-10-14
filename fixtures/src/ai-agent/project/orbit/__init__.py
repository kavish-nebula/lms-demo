"""Orbit Outdoor's project kit: a practice stand-in for the Claude API, and Orbit's policy."""

from pathlib import Path

from .model import MODEL, BadRequestError, client

POLICY = (Path(__file__).parent.parent / "docs" / "policy.md").read_text(encoding="utf-8")

__all__ = ["client", "MODEL", "POLICY", "BadRequestError"]
