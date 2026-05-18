# ClearMark — AI Watermark Remover

A production-ready single-page React app for removing watermarks, Gemini AI watermarks, logos, and other distractions using **LaMa** open-source inpainting. Brush to select regions, preview before/after, and download a lossless PNG at the original resolution.

## Features

- Drag-and-drop image upload
- Konva canvas brush & eraser selection tools
- AI inpainting via [simple-lama-inpainting](https://github.com/enesmsahin/simple-lama-inpainting)
- Before/after slider and side-by-side preview
- Original dimensions preserved (PNG output, minimal compression)
- Loading progress UI
- Responsive, mobile-friendly design

## Project structure

```
clearmark/
├── client/                 # React + Vite + Tailwind + Konva
│   └── src/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       └── utils/
└── server/                 # FastAPI + LaMa
    ├── main.py
    └── inpaint_service.py
```

## Quick start

### 1. Backend (Python 3.9+)

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

| Python | Notes |
|--------|--------|
| **3.10+** | Recommended — uses latest `simple-lama-inpainting` |
| **3.9** | Supported — uses `numpy` 2.0.x and `simple-lama-inpainting` 0.1.0 |

Install Python 3.10+ from [python.org](https://www.python.org/downloads/) or `brew install python@3.12` if you want the latest stack.

The first run downloads the LaMa model weights (~200MB).

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` to `http://localhost:8000`.

## Production build

```bash
cd client && npm run build
# Serve client/dist with any static host; set VITE_API_URL to your API origin.
```

```bash
cd server && uvicorn main:app --host 0.0.0.0 --port 8000
```

## API

| Endpoint        | Method | Description                    |
|----------------|--------|--------------------------------|
| `/api/health`  | GET    | Server & model status          |
| `/api/inpaint` | POST   | `image` + `mask` multipart PNG |

**Mask format:** white pixels = remove, black = keep (full resolution, same size as image).

## Environment

| Variable        | Default              | Description              |
|----------------|----------------------|--------------------------|
| `VITE_API_URL` | `/api` (Vite proxy)  | Frontend API base URL    |

## Hardware notes

- **CPU:** Works but slower on large images.
- **GPU:** PyTorch will use CUDA/MPS automatically when available.
- For very large images, consider downscaling in the editor before processing.

## License

MIT — LaMa model has its own license; see the [LaMa repository](https://github.com/advimman/lama).
