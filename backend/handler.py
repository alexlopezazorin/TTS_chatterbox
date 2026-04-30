import sys
import base64

print(f"[STARTUP] Python {sys.version}")
print(f"[STARTUP] Starting handler.py...")

try:
    import runpod
    print("[STARTUP] runpod imported OK")
except Exception as e:
    print(f"[STARTUP] ERROR importing runpod: {e}")
    sys.exit(1)

try:
    from tts_model import load_model, synthesize
    print("[STARTUP] tts_model imported OK")
except Exception as e:
    print(f"[STARTUP] ERROR importing tts_model: {e}")
    sys.exit(1)

try:
    load_model()
    print("[STARTUP] Model loaded OK")
except Exception as e:
    print(f"[STARTUP] ERROR loading model: {e}")
    sys.exit(1)

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
