"""What the image readers said about a shot: an agent review takes precedence over the VLM."""
from __future__ import annotations


def shot_description(rec: dict) -> str:
    """Description of a shot's picture."""
    return ((rec.get("review") or {}).get("description") or (rec.get("vlm") or {}).get("description") or "").strip()


def shot_overlay_text(rec: dict) -> list[str] | None:
    """The post-production words a reader listed; [] means it saw none, None that no reader said."""
    rv = (rec.get("review") or {}).get("overlay_text")
    if isinstance(rv, list):
        return rv
    vl = (rec.get("vlm") or {}).get("overlay_text")
    return vl if isinstance(vl, list) else None
