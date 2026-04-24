FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-devel

WORKDIR /app

RUN apt-get update && apt-get install -y libsndfile1 libgomp1 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu124

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir flash-attn --no-build-isolation

COPY . .

EXPOSE 8000

ENV SERVERLESS=1

CMD ["python", "handler.py"]
