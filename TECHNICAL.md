# Technical Documentation

Complete technical setup, configuration, and architecture guide for Learning Master.

## Prerequisites

- **Docker & Docker Compose** - For containerized deployment
- **Node.js** - For local development (recommended Node 18+)
- **npm** - Package manager

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
   # Edit .env.local and add your API credentials
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

The development server will start at `http://localhost:3000`

## Environment Variables

Configure the following environment variables in your `.env` or `.env.local` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `BEDROCK_REGION` | AWS Bedrock region | `us-west-2` |
| `BEDROCK_MODEL_ID` | Claude model ID for Bedrock | - |
| `AWS_ACCESS_KEY_ID` | AWS credentials | - |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | - |
| `AI_PROVIDER` | AI provider to use | `bedrock` |

## Build & Deployment

### Development Build

```bash
npm run dev      # Start development server with hot reload
```

### Production Build

```bash
npm run build    # Build for production
npm run preview  # Preview production build locally
```

## Docker Operations

### Building Images

```bash
make build       # Build development Docker image
make build-prod  # Build production Docker image
make size        # Show Docker image sizes
make clean       # Remove containers and volumes
```

### Docker Compose

The `docker-compose.yml` provides a complete local development environment:

```bash
# View container status
docker-compose ps

# View logs
docker-compose logs -f app

# Execute commands in container
docker-compose exec app npm run build
```

## Project Structure

```
learning-master-ai/
├── src/                          # React frontend application
│   ├── components/              # React components
│   ├── lib/                     # Core utilities and helpers
│   ├── App.tsx                  # Main application component
│   └── main.tsx                 # Application entry point
├── server.ts                    # Express backend server
├── bedrock.ts                   # AWS Bedrock AI integration
├── Dockerfile                   # Development container configuration
├── Dockerfile.prod              # Production container configuration
├── docker-compose.yml           # Local development setup
├── Makefile                     # Development commands
├── package.json                 # Dependencies and scripts
└── vite.config.ts               # Vite build configuration
```

## Technology Stack

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn, Base UI, Lucide Icons
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Markdown**: React Markdown with Remark GFM
- **State Management**: React Context API

### Backend
- **Server**: Express.js
- **Runtime**: Node.js
- **API**: RESTful endpoints

### AI & Data
- **AI Provider**: AWS Bedrock with Claude models
- **Database**: DuckDB (with WASM support)
- **Embeddings**: AI-powered text embeddings

### DevOps
- **Containerization**: Docker & Docker Compose
- **Package Manager**: npm

## Available npm Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run linter (if configured)
npm run test       # Run tests (if configured)
```

## Available Make Commands

```bash
make up           # Start containers
make down         # Stop containers
make logs         # View container logs
make restart      # Restart containers
make build        # Build development image
make build-prod   # Build production image
make size         # Show image sizes
make clean        # Remove containers and volumes
```

## Database

Learning Master uses **DuckDB** for data persistence. DuckDB is:
- Lightweight and serverless
- Runs in-process with WebAssembly support
- Perfect for educational and medium-scale applications
- No external database server required

Data is persisted in `db.json` (or configured database file).

## Development Workflow

1. **Install dependencies**: `npm install`
2. **Start dev server**: `npm run dev`
3. **Make changes** in `src/` directory
4. **Hot reload** - changes apply automatically
5. **Build for production**: `npm run build`

## Docker Deployment

### Development Deployment
```bash
make up
```

### Production Deployment
```bash
make build-prod
docker-compose -f docker-compose.yml up -d
```

## Troubleshooting

### Container won't start
```bash
make clean      # Remove old containers
make up         # Start fresh
```

### Dependencies issues
```bash
npm install     # Reinstall all dependencies
npm clean-install  # Clean reinstall (remove node_modules first)
```

### View detailed logs
```bash
make logs
# or
docker-compose logs -f app
```

## Performance Optimization

- **Production builds**: Use `npm run build` for optimized bundles
- **Docker caching**: Layers are cached for faster rebuilds
- **Database**: DuckDB is optimized for analytical queries
- **Frontend**: Vite provides fast hot module replacement

## Security

- Keep dependencies updated: `npm outdated`
- Use environment variables for sensitive credentials
- Never commit `.env` files with real credentials
- Follow the principle of least privilege for AWS credentials

## Contributing

When contributing, ensure:
1. Code follows existing patterns
2. Components are in `src/components/`
3. Utilities are in `src/lib/`
4. Environment variables are documented here
5. Docker builds pass: `make build`

## References

- [React Documentation](https://react.dev)
- [Express.js Guide](https://expressjs.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vite Documentation](https://vitejs.dev)
- [DuckDB](https://duckdb.org/)
- [AWS Bedrock](https://aws.amazon.com/bedrock/)
