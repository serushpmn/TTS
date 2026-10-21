from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def main() -> None:
    client = TestClient(app)
    select = client.post("/api/models/model_q8f16/select")
    print("select", select.status_code, select.json().get("id"), select.json().get("installed"))
    load = client.post("/api/models/model_q8f16/load")
    print("load", load.status_code, load.json())
    if load.status_code >= 400:
        raise SystemExit(1)
    preview = client.post(
        "/api/preview",
        json={"text": "Hello from Dialogue Studio ONNX.", "voice_id": "af_heart", "speed": 1.0, "model_id": "model_q8f16"},
    )
    print("preview", preview.status_code, preview.json())
    if preview.status_code >= 400:
        raise SystemExit(1)
    print("ONNX smoke OK")


if __name__ == "__main__":
    main()
