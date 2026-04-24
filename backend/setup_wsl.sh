#!/usr/bin/env bash
# WSL2 fallback — run inside Ubuntu if Windows native setup fails
set -e

echo "=== TTS Chatterbox Turbo - WSL2 setup ==="

# Install conda if needed
if ! command -v conda &>/dev/null; then
    echo "Installing Miniconda..."
    wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh
    bash /tmp/miniconda.sh -b -p "$HOME/miniconda3"
    eval "$("$HOME/miniconda3/bin/conda" shell.bash hook)"
fi

conda create -n chatterbox-tts python=3.12 -y
conda activate chatterbox-tts

echo "[1/3] Installing PyTorch with CUDA 12.4..."
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124

echo "[2/3] Installing chatterbox-tts + flash-attn (Linux supports it)..."
pip install -U chatterbox-tts
pip install flash-attn --no-build-isolation

echo "[3/3] Installing FastAPI..."
pip install "fastapi[standard]" soundfile

echo ""
echo "=== WSL2 setup complete ==="
echo "Activate with:  conda activate chatterbox-tts"
echo "Run with:       uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "NOTE: in tts_model.py add  attn_implementation='flash_attention_2'  to from_pretrained()"
echo "      for better performance under WSL2."
