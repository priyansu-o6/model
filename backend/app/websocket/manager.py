from __future__ import annotations

from typing import Any, Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    """Manage active WebSocket connections per verification session."""

    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str) -> None:
        """Accept and register a new WebSocket for a session."""
        await websocket.accept()
        self._connections.setdefault(session_id, set()).add(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str) -> None:
        """Remove a WebSocket from tracking for a session."""
        if session_id in self._connections:
            self._connections[session_id].discard(websocket)
            if not self._connections[session_id]:
                self._connections.pop(session_id, None)

    async def send_result(self, session_id: str, data: dict[str, Any]) -> None:
        """Send a JSON result to all connections for a session."""
        for ws in list(self._connections.get(session_id, set())):
            await ws.send_json(data)

    async def broadcast_to_session(self, session_id: str, message: str) -> None:
        """Broadcast a text message to all connections for a session."""
        for ws in list(self._connections.get(session_id, set())):
            await ws.send_text(message)


manager = ConnectionManager()

