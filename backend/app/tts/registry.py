from __future__ import annotations

from dataclasses import asdict, dataclass


HF_REPO = "onnx-community/Kokoro-82M-v1.0-ONNX"
HF_REVISION = "main"
VOICES_FILENAME = "voices-v1.0.bin"
# Shared voice pack used by kokoro-onnx (NpzFile with named style arrays).
VOICES_URL = (
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/"
    "model-files-v1.0/voices-v1.0.bin"
)
# Approximate size of the shared voice pack (bytes).
VOICES_APPROX_BYTES = 26_200_000


@dataclass(frozen=True)
class ModelVariant:
    id: str
    filename: str
    precision: str
    approx_bytes: int
    description: str
    recommended: bool = False
    sha256: str | None = None
    repo: str = HF_REPO
    revision: str = HF_REVISION
    runtime: str = "onnx"
    # Relative path inside the Hugging Face repo.
    repo_path: str = ""

    def __post_init__(self) -> None:
        if not self.repo_path:
            object.__setattr__(self, "repo_path", f"onnx/{self.filename}")

    @property
    def approx_size_label(self) -> str:
        mb = self.approx_bytes / (1024 * 1024)
        if mb >= 100:
            return f"{mb:.0f} MB"
        return f"{mb:.1f} MB"

    def to_public_dict(self) -> dict:
        data = asdict(self)
        data["approx_size_label"] = self.approx_size_label
        return data


# Authoritative list of selectable ONNX quantizations (metadata sizes are approximate).
ONNX_VARIANTS: tuple[ModelVariant, ...] = (
    ModelVariant(
        id="model",
        filename="model.onnx",
        precision="FP32",
        approx_bytes=326 * 1024 * 1024,
        description="Full precision. Highest fidelity, largest download and RAM use.",
    ),
    ModelVariant(
        id="model_q4",
        filename="model_q4.onnx",
        precision="Q4 matmul",
        approx_bytes=305 * 1024 * 1024,
        description="4-bit matrix multiplication. Large on disk; quality/speed vary by hardware.",
    ),
    ModelVariant(
        id="model_uint8",
        filename="model_uint8.onnx",
        precision="UINT8 / mixed",
        approx_bytes=177 * 1024 * 1024,
        description="8-bit and mixed precision. Mid-size compromise.",
    ),
    ModelVariant(
        id="model_fp16",
        filename="model_fp16.onnx",
        precision="FP16",
        approx_bytes=163 * 1024 * 1024,
        description="Half precision. Good quality with reduced size versus FP32.",
    ),
    ModelVariant(
        id="model_q4f16",
        filename="model_q4f16.onnx",
        precision="Q4 + FP16",
        approx_bytes=154 * 1024 * 1024,
        description="4-bit matmul with FP16 weights. Smaller than Q4-only.",
    ),
    ModelVariant(
        id="model_uint8f16",
        filename="model_uint8f16.onnx",
        precision="UINT8 + FP16",
        approx_bytes=114 * 1024 * 1024,
        description="Mixed UINT8/FP16. Compact mid-tier option.",
    ),
    ModelVariant(
        id="model_quantized",
        filename="model_quantized.onnx",
        precision="INT8 quantized",
        approx_bytes=int(92.4 * 1024 * 1024),
        description="8-bit quantized. Small footprint; listen to compare quality.",
    ),
    ModelVariant(
        id="model_q8f16",
        filename="model_q8f16.onnx",
        precision="Q8 + FP16",
        approx_bytes=86 * 1024 * 1024,
        description="Smallest listed variant. Recommended ONNX default; verified on Windows CPU (ORT graph optimizations disabled). Listen before judging quality.",
        recommended=True,
        # From Hugging Face LFS pointer for onnx-community/Kokoro-82M-v1.0-ONNX.
        sha256="04c658aec1b6008857c2ad10f8c589d4180d0ec427e7e6118ceb487e215c3cd0",
    ),
)

TORCH_ENGINE_ID = "kokoro-torch"

TORCH_VARIANT = ModelVariant(
    id=TORCH_ENGINE_ID,
    filename="(pytorch)",
    precision="PyTorch FP32",
    approx_bytes=0,
    description="Original Kokoro PyTorch pipeline. Uses packages already installed; voice packs download on first use. Not an ONNX file.",
    recommended=False,
    runtime="torch",
    repo="hexgrad/Kokoro-82M",
    repo_path="",
)

DEFAULT_ONNX_MODEL_ID = "model_q8f16"
# Preserve working installs: prefer Torch until the user installs an ONNX model.
DEFAULT_MODEL_ID = TORCH_ENGINE_ID


def get_variant(model_id: str) -> ModelVariant | None:
    if model_id == TORCH_ENGINE_ID:
        return TORCH_VARIANT
    return next((item for item in ONNX_VARIANTS if item.id == model_id), None)


def all_variants() -> list[ModelVariant]:
    return [TORCH_VARIANT, *ONNX_VARIANTS]


def require_variant(model_id: str) -> ModelVariant:
    variant = get_variant(model_id)
    if not variant:
        known = ", ".join(item.id for item in all_variants())
        raise ValueError(f"Unknown model '{model_id}'. Known: {known}")
    return variant
