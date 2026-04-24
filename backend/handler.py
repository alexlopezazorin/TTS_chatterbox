import base64
import runpod
from tts_model import load_model, synthesize

load_model()

def handler(job):
    text = job["input"].get("text", "")
    if not text.strip():
        return {"error": "text cannot be empty"}
    try:
        audio_bytes = synthesize(text)
        return {"audio": base64.b64encode(audio_bytes).decode()}
    except Exception as e:
        return {"error": str(e)}

runpod.serverless.start({"handler": handler})
