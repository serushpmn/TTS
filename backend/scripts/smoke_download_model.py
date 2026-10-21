from __future__ import annotations

import sys
import time

from fastapi.testclient import TestClient

from app.main import app


def main() -> None:
    model_id = sys.argv[1] if len(sys.argv) > 1 else "model_q8f16"
    client = TestClient(app)
    response = client.post(f"/api/models/{model_id}/download")
    print("model job", response.status_code, response.json())
    if response.status_code >= 400:
        raise SystemExit(1)
    job = response.json()
    for index in range(600):
        status = client.get(f"/api/models/downloads/{job['id']}").json()
        print(
            index,
            status["status"],
            status.get("progress"),
            status.get("bytes_downloaded"),
            status.get("error"),
        )
        if status["status"] in ("done", "error", "cancelled"):
            break
        time.sleep(3)


if __name__ == "__main__":
    main()
