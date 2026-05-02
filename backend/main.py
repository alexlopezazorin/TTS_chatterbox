import base64
import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from tts_model import load_model, split_sentences, synthesize


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(lifespan=lifespan)

_origin = os.environ.get("ALLOWED_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_origin],
    allow_methods=["POST"],
    allow_headers=["*"],
)


class TTSRequest(BaseModel):
    text: str


@app.post("/speak")
async def speak(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text cannot be empty")
    try:
        audio_bytes = synthesize(req.text)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return Response(content=audio_bytes, media_type="audio/wav")


@app.post("/speak/stream")
async def speak_stream(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text cannot be empty")

    async def generate():
        for sentence in split_sentences(req.text):
            try:
                audio_bytes = synthesize(sentence)
                data = base64.b64encode(audio_bytes).decode()
                yield f"data: {json.dumps({'audio': data})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                return
        yield 'data: {"done":true}\n\n'

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
