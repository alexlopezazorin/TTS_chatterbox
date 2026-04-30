FROM liamvisionary/chatterbox-tts-runpod:latest

WORKDIR /app

RUN pip install --no-cache-dir chatterbox-tts "transformers<4.47.0" resemble-perth runpod

COPY . .

ENV SERVERLESS=1
ENV PYTHONUNBUFFERED=1

CMD ["python", "handler.py"]
