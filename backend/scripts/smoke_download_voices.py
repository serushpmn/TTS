from __future__ import annotations

import time

from fastapi.testclient import TestClient

from app.main import app


def main() -> None:
    client = TestClient(app)
    response = client.post("/api/models/voices/download")
    print("voices job", response.status_code, response.json())
    job = response.json()
    for index in range(180):
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
        time.sleep(2)


if __name__ == "__main__":
    main()
