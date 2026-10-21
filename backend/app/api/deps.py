from __future__ import annotations

from fastapi import HTTPException


def fail(error: Exception) -> HTTPException:
    return HTTPException(status_code=400, detail=str(error))
