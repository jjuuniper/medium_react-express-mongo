# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## **Required Project Philosophy**
- Security is the number one priority
- NEVER compromise security at any point
- Secrets should NEVER be exposed in plain text
- ALWAYS leverage existing tools and libraries
- NEVER "reinvent the wheel"
- If there are tools and libraries that have needed functionliaty, use them, do not create a custom solution
- ALWAYS prefer to properly leverage existing tools, libraries and frameworks
- NEVER write custom code unless absolutely necessary
- NEVER over-engineer
- The less code that is written the better
- Development should be precise and robust
- ALWAYS follow programming and security best practices
- ALWAYS implement proper error handling, and compliance

## Project Overview

This is a RealWorld backend implementation built with Express.js, MongoDB, and JavaScript. It follows the [RealWorld API specification](https://github.com/gothinkster/realworld) and provides a fully functional blogging platform backend with CRUD operations, authentication, routing, and pagination.

The main application code is located in the `backend/` directory.

## Development Commands

### Native Development (without Docker)
```bash
cd backend

# Install dependencies
npm install

# Development mode (with nodemon for auto-restart)
npm run dev

# Production mode
npm start

# Note: No test suite is currently configured
```

### Docker Development (Multi-Container)
```bash
# Copy environment template and configure
cp .env.example .env
# Edit .env with your desired configuration

# Production deployment (all services)
docker-compose up -d

# Development with hot reload (all services)
docker-compose -f docker-compose.dev.yml up

# View logs for specific services
docker-compose logs -f app
docker-compose logs -f frontend
docker-compose logs -f mongodb

# Stop all containers
docker-compose down

# Stop and remove volumes (destroys data)
docker-compose down -v

# Build specific containers
docker-compose build app
docker-compose build frontend

# Execute commands in running containers
docker-compose exec app npm run dev
docker-compose exec frontend npm run dev
docker-compose exec mongodb mongosh

# Scale services (production)
docker-compose up -d --scale frontend=2
```

## Docker Architecture

### Container Setup
The application uses a complete multi-container architecture with three services:

**Frontend Container (Next.js)**
- Base image: `node:18-alpine`
- Port: 3000 (exposed to host)
- React Server Components + TypeScript
- Hot reload in development mode
- Standalone output for production

**Backend Container (Express.js)**
- Base image: `node:18-alpine`
- Port: 4000 (exposed to host)
- Health checks enabled
- Non-root user for security
- Hot reload in development mode

**Database Container (MongoDB)**
- Base image: `mongo:6`
- Port: 27017 (internal network only in production)
- Persistent volume storage
- Authentication enabled
- Health checks enabled

### Container Networking
- Custom Docker bridge network isolates all containers
- Frontend connects to backend using container name resolution
- Backend connects to MongoDB using container name resolution
- Only frontend (3000) and backend (4000) ports exposed to host
- MongoDB only accessible within container network (security)
- CORS configured for container-to-container communication

### Environment Configuration
Copy `.env.example` to `.env` and configure:

**Backend Configuration:**
- `MONGO_ROOT_USERNAME` - MongoDB admin username
- `MONGO_ROOT_PASSWORD` - MongoDB admin password  
- `MONGO_DB_NAME` - Database name
- `ACCESS_TOKEN_SECRET` - JWT signing secret
- `NODE_ENV` - Environment (development/production)
- `PORT` - Backend port (default: 4000)

**Frontend Configuration:**
Frontend environment is handled automatically via docker-compose:
- `API_BASE_URL` - Points to backend container (http://app:4000/api)
- `NODE_ENV` - Matches container environment

### Access URLs
- **Frontend**: http://localhost:3000 - Complete RealWorld application UI
- **Backend API**: http://localhost:4000/api - REST API endpoints  
- **Backend Root**: http://localhost:4000 - Basic HTML page
- **MongoDB**: Internal only (not exposed to host)

## Architecture and Structure

### Entry Point
- Main application: `api/index.js` - Sets up Express server, middleware, routes, and MongoDB connection

### Directory Structure
- `config/` - Database connection and CORS configuration
- `models/` - Mongoose schemas (User, Article, Comment, Tag)
- `controllers/` - Business logic for each resource
- `routes/` - Express route definitions
- `middleware/` - Authentication middleware (JWT verification)
- `public/` - Static files
- `views/` - View templates

### Route Structure
All API routes follow the RealWorld specification:
- `/api/users` and `/api/user` - User registration, login, profile management
- `/api/profiles` - User profiles and following functionality  
- `/api/articles` - Article CRUD operations
- `/api/articles/:slug/comments` - Comment management
- `/api/tags` - Available tags

### Database
- Uses MongoDB with Mongoose ODM
- Connection configured in `config/dbConnect.js`
- Requires `DATABASE_URI` environment variable

### Authentication
- JWT-based authentication
- Middleware: `verifyJWT.js` (required) and `verifyJWTOptional.js` (optional)
- Uses `access_token_secret` environment variable

### Key Design Decisions
- Single JWT secret for all authentication (security tradeoff noted in README)
- Embedded arrays for comments in articles and favorited articles in users (scalability tradeoff)
- Case-sensitive usernames
- Uses bcrypt for password hashing
- Implements slugification for article URLs

## Kubernetes Deployment

### Kubernetes Manifests (`k8s/`)
Raw Kubernetes YAML files for manual deployment:
```bash
# Build images with proper names
docker-compose build

# Deploy all components
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets/secret-dev.yaml  # Demo secrets
kubectl apply -f k8s/mongodb/ k8s/backend/ k8s/frontend/
kubectl apply -f k8s/ingress.yaml

# Access application
kubectl port-forward -n realworld svc/frontend 3000:3000
```

### Helm Charts (`helm/realworld/`)
Templated deployments with environment-specific configurations:

#### Development Deployment
```bash
# Build development images first
docker build --target development -t realworld-backend:dev ./backend
docker build --target development -t realworld-frontend:dev ./frontend

# Deploy development environment (1 replica each, demo secrets)
helm install realworld ./helm/realworld -f ./helm/realworld/values-dev.yaml

# Access application
kubectl port-forward svc/frontend 3000:3000 -n realworld
# Visit: http://localhost:3000
```

#### Production Deployment
```bash
# Build production images first
docker build --target production -t realworld-backend:latest ./backend
docker build --target production -t realworld-frontend:latest ./frontend

# Deploy production environment (3 replicas each, external secrets)
helm install realworld ./helm/realworld \
  -f ./helm/realworld/values.yaml \
  -f ./helm/realworld/values-prod.yaml \
  -f ./helm/realworld/values-local-secrets.yaml

# Access application
kubectl port-forward svc/frontend 3001:3000 -n realworld
# Visit: http://localhost:3001
```

### Environment Comparison

| Aspect | Development | Production |
|--------|-------------|------------|
| **Replicas** | 1 backend, 1 frontend | 3 backend, 3 frontend |
| **Images** | `:dev` (development stage) | `:latest` (production stage) |
| **Build Type** | Hot reload, dev server | Pre-built, optimized bundle |
| **Memory Limits** | Frontend (1Gi), MongoDB (512Mi) | Frontend (512Mi), MongoDB (1Gi) |
| **Startup Time** | Slower (on-demand compilation) | Fast (Ready in ~400ms) |
| **Secrets** | Demo values (values-dev.yaml) | External (values-local-secrets.yaml) |
| **Use Case** | Feature development, debugging | Performance testing, production-like |

### Image Configuration
- **Development**: Non-root users, devDependencies, hot reload, larger memory for compilation
- **Production**: Non-root users, optimized builds, minimal dependencies, faster startup
- **Security**: Both stages use non-root users and proper file ownership

### Secret Management
- **Development**: Demo secrets in `values-dev.yaml` (safe to commit)
- **Production**: External secrets via local files or CI/CD environment variables
- **Security**: All production secrets protected by `.gitignore` patterns
- **StatefulSet DNS**: Uses `mongodb-0.mongodb` for headless service resolution

### Deployment Workflow
```bash
# 1. Choose environment and build appropriate images
# Development:
docker build --target development -t realworld-backend:dev ./backend
docker build --target development -t realworld-frontend:dev ./frontend
helm install realworld ./helm/realworld -f ./helm/realworld/values-dev.yaml

# Production:
docker build --target production -t realworld-backend:latest ./backend
docker build --target production -t realworld-frontend:latest ./frontend
helm install realworld ./helm/realworld \
  -f ./helm/realworld/values.yaml \
  -f ./helm/realworld/values-prod.yaml \
  -f ./helm/realworld/values-local-secrets.yaml

# 2. Verify deployment
kubectl get pods -n realworld -w

# 3. Access application
kubectl port-forward svc/frontend 3000:3000 -n realworld  # Dev
kubectl port-forward svc/frontend 3001:3000 -n realworld  # Prod
```

### Troubleshooting & Restart Deployments
```bash
# Check pod status and issues
kubectl get pods -n realworld
kubectl describe pod <pod-name> -n realworld
kubectl logs <pod-name> -n realworld

# Rolling restart (zero downtime)
kubectl rollout restart deployment -n realworld
kubectl rollout restart statefulset/mongodb -n realworld

# Complete restart (when upgrade fails)
helm uninstall realworld
# Then reinstall with appropriate values file

# Force image updates (rebuild images first, then upgrade)
helm upgrade realworld ./helm/realworld -f ./helm/realworld/values-<env>.yaml
```

### Common Issues & Solutions
- **OOMKilled**: Increase memory limits in values files
- **ImagePullBackOff**: Rebuild images with correct tags and stages
- **CrashLoopBackOff**: Check logs for permission issues, authentication failures
- **Probe failures**: MongoDB probes need 20s timeout with authentication
- **Init containers stuck**: Check MongoDB readiness and DNS resolution

## Environment Variables Required
- `DATABASE_URI` - MongoDB connection string
- `access_token_secret` - JWT signing secret
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (defaults to 4000)