from __future__ import annotations

from workers.celery_app import app


@app.task(name="report_generation.run")
def run_report_generation(session_id: str) -> dict:
    """Placeholder task for generating verification reports."""
    return {"session_id": session_id, "status": "pending", "detail": "Report generation not yet implemented."}

