# Step 1: NVIDIA CUDA official base, compatible with RTX 4090
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive
ENV SERVERLESS=1

# Step 2: Python 3.10 + system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3-pip \
    libsndfile1 \
    ffmpeg \
    git \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip first to avoid install issues
RUN python3.10 -m pip install --upgrade pip setuptools wheel

# Step 2: PyTorch with CUDA 12.4
RUN python3.10 -m pip install --no-cache-dir \
    torch==2.6.0+cu124 \
    torchaudio==2.6.0+cu124 \
    --index-url https://download.pytorch.org/whl/cu124

# Step 3+4: Chatterbox dependencies first, then chatterbox with --no-deps
RUN python3.10 -m pip install --no-cache-dir \
    conformer==0.3.2 \
    diffusers==0.29.0 \
    "transformers<4.47.0" \
    resemble-perth==1.0.1 \
    s3tokenizer==0.3.0 \
    onnx==1.16.0 \
    librosa \
    omegaconf \
    safetensors \
    huggingface_hub \
    pyloudnorm \
    runpod

RUN python3.10 -m pip install --no-cache-dir --no-deps chatterbox-tts

# Step 5: RunPod handler
COPY . .

CMD ["python3.10", "handler.py"]
