# Learning Master

An intelligent learning management system powered by AI that helps users create, organize, and master educational content through interactive quizzes, flashcards, and adaptive learning features.

## Features

- **Note Editor** - Create and organize study notes with rich formatting
- **Flashcards** - Build and review flashcard decks with spaced repetition
- **Quiz System** - Generate AI-powered quizzes from your notes
- **Chat Assistant** - Get AI-powered help and explanations
- **Dashboard** - Track your learning progress and statistics
- **Kanban Board** - Organize learning tasks and projects
- **Learning Book** - Create comprehensive learning materials
- **Management Console** - Manage notes, flashcards, and learning resources

## Prerequisites

- Docker & Docker Compose
- Node.js (for local development)

## Quick Start

### Using Docker (Recommended)

```bash
make up          # Start the app with docker-compose
make logs        # View app logs
make down        # Stop the app
make restart     # Restart the app
```

The app will be available at `http://localhost:3000`

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your GEMINI_API_KEY
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

- `GEMINI_API_KEY` - Your Google Gemini API key (required for AI features)
- `AI_PROVIDER` - AI provider to use (default: 'gemini')
- `GEMINI_TEXT_MODEL` - Text model to use (default: 'gemini-3-flash-preview')
- `GEMINI_EMBED_MODEL` - Embedding model to use (default: 'gemini-embedding-2-preview')

## Build

```bash
npm run build    # Build for production
npm run preview  # Preview production build
```

## Docker Commands

```bash
make build       # Build development Docker image
make build-prod  # Build production Docker image
make size        # Show Docker image sizes
make clean       # Remove containers and volumes
```

## Project Structure

- `src/` - React frontend application
- `server.ts` - Express backend server
- `src/lib/` - Core libraries and utilities
- `src/components/` - React components for different features
- `docker-compose.yml` - Docker setup for local development
- `Dockerfile` / `Dockerfile.prod` - Container configurations

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Express, Node.js
- **AI**: Google Gemini API
- **Database**: DuckDB (with WASM support)
- **Styling**: Tailwind CSS, Tailwind Merge
- **UI Components**: shadcn, Base UI, Lucide Icons
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Markdown**: React Markdown, Remark GFM
