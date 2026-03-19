from __future__ import annotations

from workers.celery_app import app


@app.task(name="audio_analysis.run")
def run_audio_analysis(session_id: str) -> dict:
    """Placeholder task for running audio deepfake analysis."""
    return {"session_id": session_id, "status": "pending", "detail": "Audio analysis not yet implemented."}

