from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def main() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/benchmarks",
        json={
            "model_ids": ["kokoro-torch", "model_q8f16"],
            "text": "Hello from the benchmark suite.",
            "voice_id": "af_heart",
            "speed": 1.0,
            "include_listening_samples": False,
        },
    )
    print(response.status_code)
    payload = response.json()
    for row in payload.get("results", []):
        print(row.get("model_id"), "measured=", row.get("measured"), "error=", row.get("error"))
        if row.get("measured"):
            print(
                "  load",
                round(row.get("load_seconds") or 0, 3),
                "first",
                round(row.get("first_generation_seconds") or 0, 3),
                "warm",
                round(row.get("warm_generation_seconds") or 0, 3),
                "rtf",
                row.get("realtime_factor"),
            )


if __name__ == "__main__":
    main()
