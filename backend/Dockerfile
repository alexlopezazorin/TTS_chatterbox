FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

RUN pip install --no-cache-dir chatterbox-tts "transformers<4.47.0" resemble-perth runpod

RUN python -c "from chatterbox.tts_turbo import ChatterboxTurboTTS; print('[OK] chatterbox.tts_turbo import successful')"

COPY . .

ENV SERVERLESS=1
ENV PYTHONUNBUFFERED=1

CMD ["python", "handler.py"]
