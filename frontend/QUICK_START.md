# Frontend Quick Start Guide

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Backend API running on `http://localhost:5000`

## Setup

1. **Install dependencies**:
```bash
cd frontend
npm install
# or
yarn install
# or
pnpm install
```

2. **Configure environment**:
Create `.env`:
```env
VITE_PORT=5174
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
```

3. **Run development server**:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Project Structure

```
frontend/
├── app/                    # Next.js 14 app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Dashboard page
│   └── repo/
│       └── [id]/
│           ├── page.tsx   # Repo overview
│           ├── runs/
│           │   └── [runId]/
│           │       └── page.tsx
│           └── pulls/
│               └── [prId]/
│                   └── page.tsx
├── components/            # React components
├── lib/                   # Utilities
├── hooks/                 # Custom hooks
├── store/                 # Zustand stores
└── types/                 # TypeScript types
```

## Key Dependencies

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Query** - Data fetching
- **Zustand** - State management
- **Monaco Editor** - Code viewing
- **Recharts** - Charts
- **react-window** - Virtualization

## Development Workflow

1. Start with the dashboard page (`app/page.tsx`)
2. Build components incrementally
3. Use React Query for API calls
4. Use Zustand for UI state
5. Follow the component tree in `FRONTEND_DESIGN.md`

## Next Steps

1. Read `FRONTEND_DESIGN.md` for complete architecture
2. Check `src/types/index.ts` for all TypeScript interfaces
3. Follow the MVP roadmap (Week 1-5+)
4. Refer to backend API documentation for endpoints

