from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import HistoryItem
from app.services.history import delete_history, list_history

router = APIRouter(tags=["history"])


@router.get("/api/history", response_model=list[HistoryItem])
def history() -> list[HistoryItem]:
    return list_history()


@router.delete("/api/history/{item_id}", response_model=HistoryItem)
def remove_history(item_id: str) -> HistoryItem:
    item = delete_history(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="History item not found.")
    return item
