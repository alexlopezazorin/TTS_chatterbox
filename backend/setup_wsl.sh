#!/usr/bin/env bash
set -e

echo "=== TTS Chatterbox Turbo - WSL2 setup ==="

# Install Miniconda if not present
if ! command -v conda &>/dev/null && [ ! -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
    echo "Installing Miniconda..."
    wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh
    bash /tmp/miniconda.sh -b -p "$HOME/miniconda3"
fi

source "$HOME/miniconda3/etc/profile.d/conda.sh"

if conda env list | grep -q "^chatterbox-tts"; then
    echo "Env 'chatterbox-tts' already exists, updating..."
else
    conda create -n chatterbox-tts python=3.10 -y
fi

conda activate chatterbox-tts

echo "[1/4] Installing PyTorch with CUDA 12.4..."
pip install torch==2.6.0+cu124 torchaudio==2.6.0+cu124 \
    --index-url https://download.pytorch.org/whl/cu124

echo "[2/4] Installing chatterbox-tts dependencies..."
pip install \
    conformer diffusers "transformers<4.47.0" \
    s3tokenizer safetensors huggingface_hub \
    pyloudnorm resemble-perth \
    librosa omegaconf \
    psutil runpod soundfile

echo "[3/4] Installing chatterbox-tts (no-deps to avoid version conflicts)..."
pip install chatterbox-tts --no-deps

echo "[4/4] Installing FastAPI..."
pip install "fastapi[standard]"

echo ""
echo "=== WSL2 setup complete ==="
echo ""
echo "To start the backend:"
echo "  source ~/miniconda3/etc/profile.d/conda.sh"
echo "  conda activate chatterbox-tts"
echo "  cd /mnt/c/Users/alexl/Desktop/TTS_chatterbox/backend"
echo "  uvicorn main:app --host 0.0.0.0 --port 8000"
