# TTS Chatterbox Turbo

Next.js frontend (Vercel) + Python FastAPI backend (local) / RunPod serverless (deploy).

---

## Frontend — Windows

Requires Node.js 18+.

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Create `frontend/.env.local` for production (leave empty for local dev):

```env
# Leave blank to use local backend at http://localhost:8000
RUNPOD_API_KEY=
RUNPOD_ENDPOINT_ID=
```

---

## Backend — Windows (nativo)

Requires Python 3.10+ y una GPU NVIDIA con CUDA 12.4.

**Primera vez:**
```bat
cd backend
setup.bat
```

**Arrancar:**
```bat
cd backend
.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

> `torch.compile` (Triton) no está disponible en Windows — el modelo corre en eager mode. El RTF es algo más alto que en Linux/WSL.

---

## Backend — WSL2

Mejor opción para desarrollo local: activa `torch.compile` con Triton, RTF similar al deploy en RunPod.

Requisito previo: drivers NVIDIA actualizados en Windows (WSL2 hereda la GPU del host). Verificar con:
```bash
wsl nvidia-smi
```

### Primera vez — setup

Abre una terminal WSL y ejecuta:

```bash
cd /mnt/c/Users/alexl/Desktop/TTS_chatterbox/backend
bash setup_wsl.sh
```

Esto instala Miniconda (si no existe) y crea el entorno `chatterbox-tts` con todas las dependencias.

### Arrancar

```bash
source ~/miniconda3/etc/profile.d/conda.sh
conda activate chatterbox-tts
cd /mnt/c/Users/alexl/Desktop/TTS_chatterbox/backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

O como one-liner desde PowerShell:
```powershell
wsl bash -c "source ~/miniconda3/etc/profile.d/conda.sh && conda activate chatterbox-tts && cd /mnt/c/Users/alexl/Desktop/TTS_chatterbox/backend && uvicorn main:app --host 0.0.0.0 --port 8000"
```

### Notas de startup en WSL2

- Primera vez: descarga los pesos del modelo desde HuggingFace (~2 GB, se cachean en `~/.cache/huggingface`)
- `torch.compile` con Triton se activa automáticamente (detecta `sys.platform == "linux"`)
- El warmup tarda ~20-30 s extra al arrancar — es normal, compila los kernels CUDA
- El frontend en Windows conecta a `http://localhost:8000` directamente (WSL2 hace port-forward automático)

### Warnings esperados (no son errores)

- `Warning: Error in norm_loudness, skipping` — interacción de `pyloudnorm` con torch dynamo durante el warmup; no afecta al audio
- `LoRACompatibleLinear FutureWarning` — versión de diffusers más nueva que la que pina chatterbox-tts; compatible

---

## Deploy — Vercel + RunPod

El backend se construye como imagen Docker y se sube a GHCR vía GitHub Actions (`.github/workflows/build-backend.yml`). Se dispara automáticamente al hacer push a `master` con cambios en `backend/`.

Variables de entorno necesarias en Vercel:
```env
RUNPOD_API_KEY=...
RUNPOD_ENDPOINT_ID=...
```
