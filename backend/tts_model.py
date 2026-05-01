import io
import os
import sys
import time
import torch
import torchaudio as ta
from pathlib import Path

# PyTorch 2.5+ defaults weights_only=True which blocks chatterbox's LlamaModel checkpoint
_orig_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _orig_torch_load(*args, **kwargs)
torch.load = _patched_torch_load


VOICE_DIR = Path(__file__).parent / "voices"
DEFAULT_VOICE_AUDIO = VOICE_DIR / "default.wav"
DEFAULT_VOICE_TEXT = VOICE_DIR / "default.txt"

_model = None


def _patch_s3tokenizer():
    # Replace log_mel_spectrogram with a dtype-safe version.
    # audio must be float32 before STFT — numpy arrays default to float64 which
    # propagates through STFT → mel → encoder and hits mask_to_bias's dtype assert.
    import torch.nn.functional as F
    from chatterbox.models.s3tokenizer.s3tokenizer import S3Tokenizer, S3_HOP

    def _safe_log_mel_spectrogram(self, audio, padding=0):
        if not torch.is_tensor(audio):
            audio = torch.from_numpy(audio)
        audio = audio.to(device=self.device, dtype=torch.float32)
        if padding > 0:
            audio = F.pad(audio, (0, padding))
        stft = torch.stft(
            audio, self.n_fft, S3_HOP,
            window=self.window.to(self.device),
            return_complex=True,
        )
        magnitudes = stft[..., :-1].abs() ** 2
        mel_spec = self._mel_filters.to(device=self.device, dtype=torch.float32) @ magnitudes
        log_spec = torch.clamp(mel_spec, min=1e-10).log10()
        log_spec = torch.maximum(log_spec, log_spec.max() - 8.0)
        log_spec = (log_spec + 4.0) / 4.0
        return log_spec

    S3Tokenizer.log_mel_spectrogram = _safe_log_mel_spectrogram
    print("[TTS] s3tokenizer log_mel_spectrogram patched (dtype-safe).")


def _patch_mask_to_bias():
    # model_v2.py uses `from s3tokenizer.utils import mask_to_bias` (local binding),
    # so we must patch the name in model_v2's namespace directly.
    # The assertion fails when x.dtype is float64 (or any non-float16/32/bf16 type)
    # coming out of the encoder Conv1d layers.
    import s3tokenizer.model_v2 as _s3_model_v2

    def _safe_mask_to_bias(mask: torch.Tensor, dtype: torch.dtype) -> torch.Tensor:
        assert mask.dtype == torch.bool
        if dtype not in (torch.float32, torch.bfloat16, torch.float16):
            print(f"[s3tokenizer] mask_to_bias: unexpected dtype {dtype}, forcing float32")
            dtype = torch.float32
        mask = mask.to(dtype)
        mask = (1.0 - mask) * -1.0e+10
        return mask

    _s3_model_v2.mask_to_bias = _safe_mask_to_bias
    print("[TTS] s3tokenizer model_v2.mask_to_bias patched (dtype-safe).")


def _patch_perth():
    import perth
    class _NoopWatermarker:
        def apply_watermark(self, audio, **kwargs):
            return audio
    perth.PerthImplicitWatermarker = _NoopWatermarker
    print("[TTS] perth watermarking disabled.")


def load_model():
    global _model
    if _model is not None:
        return _model

    _patch_s3tokenizer()
    _patch_mask_to_bias()
    _patch_perth()
    from chatterbox.tts_turbo import ChatterboxTurboTTS

    device = "cuda" if torch.cuda.is_available() else "cpu"

    print(f"[TTS] CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"[TTS] GPU: {torch.cuda.get_device_name(0)} | "
              f"VRAM free: {torch.cuda.mem_get_info(0)[0]/1024**3:.1f} GB / "
              f"{torch.cuda.mem_get_info(0)[1]/1024**3:.1f} GB")

    print(f"[TTS] Loading ChatterboxTurbo on {device}...")
    _model = ChatterboxTurboTTS.from_pretrained(device=device)

    if torch.cuda.is_available():
        used = (torch.cuda.mem_get_info(0)[1] - torch.cuda.mem_get_info(0)[0]) / 1024**3
        print(f"[TTS] Model loaded | VRAM used: {used:.1f} GB")

    if torch.cuda.is_available() and sys.platform == "linux" and not os.environ.get("SERVERLESS"):
        print("[TTS] Compiling model with torch.compile (Triton)...")
        _model.generate = torch.compile(_model.generate, mode="reduce-overhead", dynamic=True)

    if not os.environ.get("SERVERLESS"):
        print("[TTS] Warming up CUDA kernels...")
        t_warm = time.perf_counter()
        with torch.inference_mode():
            _model.generate("warmup.", audio_prompt_path=str(DEFAULT_VOICE_AUDIO))
        print(f"[TTS] Warmup done in {time.perf_counter() - t_warm:.2f}s | Model ready.")

    print("[TTS] Model ready.")
    return _model


def synthesize(text: str) -> bytes:
    if not DEFAULT_VOICE_AUDIO.exists():
        raise FileNotFoundError(
            f"Reference voice not found at {DEFAULT_VOICE_AUDIO}. "
            "Place a 10-15 s clean mono WAV file there."
        )

    model = load_model()

    print(f"[TTS] Synthesizing {len(text)} chars...")
    t0 = time.perf_counter()

    with torch.inference_mode():
        wav = model.generate(text, audio_prompt_path=str(DEFAULT_VOICE_AUDIO))

    inference_s = time.perf_counter() - t0

    # wav is a tensor (channels, samples) or (samples,)
    if wav.dim() == 1:
        wav = wav.unsqueeze(0)
    wav = wav.cpu().float()

    audio_s = wav.shape[-1] / model.sr
    rtf = inference_s / audio_s
    print(
        f"[TTS] Done in {inference_s:.2f}s | "
        f"audio duration: {audio_s:.2f}s | "
        f"RTF: {rtf:.2f}x"
    )

    buf = io.BytesIO()
    ta.save(buf, wav, model.sr, format="wav")
    buf.seek(0)
    return buf.read()
