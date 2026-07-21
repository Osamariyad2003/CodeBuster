# Port Configuration

## Default Ports

- **Backend (Flask)**: `5000`
- **Frontend (Vite)**: `5174`

## Configuration

### Backend Port

The backend port can be configured via environment variable:

```env
PORT=5000
```

If not set, defaults to `5000`.

**Usage:**
```bash
# Set in .env file
PORT=8000

# Or override when running
PORT=8000 python app.py
```

### Frontend Port

The frontend port can be configured via environment variable:

```env
VITE_PORT=5174
```

If not set, defaults to `5174`.

**Usage:**
```bash
# Set in .env file
VITE_PORT=3000

# Or override when running
VITE_PORT=3000 npm run dev
```

## Environment Variables

### Backend (.env)

```env
# Server Port
PORT=5000

# Frontend URL (for CORS and OAuth redirects)
FRONTEND_URL=http://localhost:5174
FRONTEND_PORT=5174
```

### Frontend (.env)

```env
# Frontend Port
VITE_PORT=5174

# Backend API URL
VITE_API_URL=http://localhost:5000

# WebSocket URL (for runtime mode)
VITE_WS_URL=ws://localhost:5000
```

## Changing Ports

### To change backend port to 8000:

1. Update `backend/.env`:
```env
PORT=8000
```

2. Update `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### To change frontend port to 3000:

1. Update `frontend/.env`:
```env
VITE_PORT=3000
```

2. Update `backend/.env`:
```env
FRONTEND_URL=http://localhost:3000
FRONTEND_PORT=3000
```

## CORS Configuration

The backend automatically allows requests from:
- The `FRONTEND_URL` environment variable
- `http://localhost:5174` (default)
- `http://localhost:5173` (Vite default)
- `http://localhost:3000` (common React port)

If you change ports, make sure to update `FRONTEND_URL` in the backend `.env` file.

## Quick Reference

| Service | Default Port | Config Variable | File |
|---------|-------------|-----------------|------|
| Backend | 5000 | `PORT` | `backend/.env` |
| Frontend | 5174 | `VITE_PORT` | `frontend/.env` |

## Testing Ports

After changing ports, test the configuration:

```bash
# Test backend
curl http://localhost:5000/health

# Test frontend (should show Vite dev server)
curl http://localhost:5174
```

