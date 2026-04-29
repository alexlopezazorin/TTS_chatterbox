FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-devel

WORKDIR /app

RUN apt-get update && apt-get install -y libsndfile1 libgomp1 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN printf "torchaudio==2.5.1\n" > /tmp/constraints.txt && \
    pip install --no-cache-dir -c /tmp/constraints.txt -r requirements.txt && \
    pip install --no-cache-dir --force-reinstall "torchvision==0.20.1" --index-url https://download.pytorch.org/whl/cu124

COPY . .

EXPOSE 8000
ENV SERVERLESS=1
ENV PYTHONUNBUFFERED=1

CMD ["python", "handler.py"]
