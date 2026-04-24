@echo off
echo === TTS Chatterbox Turbo - Windows setup ===

python -m venv .venv
call .venv\Scripts\activate

echo [1/2] Installing PyTorch with CUDA 12.4 + torchvision + torchaudio (must be together)...
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

echo [2/2] Installing chatterbox-tts and FastAPI...
pip install chatterbox-tts "fastapi[standard]"

echo.
echo === Setup complete ===
echo Run with:  .venv\Scripts\activate  ^&^&  uvicorn main:app --reload
pause
