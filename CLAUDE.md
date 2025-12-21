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

### NetworkPolicy Considerations
Production deployments use NetworkPolicy for security (disabled in dev). When adding new services or namespaces that need to communicate with the RealWorld application:

**Current NetworkPolicy allows ingress from:**
- Pods within `realworld` namespace (pod-to-pod)
- `ingress-nginx` namespace (external traffic)
- `monitoring` namespace (Prometheus scraping)
- DNS queries (port 53)

**To allow a new namespace to access RealWorld services:**
Edit `helm/realworld/templates/network-policy.yaml` and add:
```yaml
- from:
  - namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: [NEW_NAMESPACE]
```

**Note:** Dev has `networkPolicy.enabled: false` for easier local development. Always test NetworkPolicy changes in a production-like environment.

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

## Monitoring with Prometheus & Grafana

### Architecture Overview

The monitoring stack uses **kube-prometheus-stack**, which includes:
- **Prometheus** - Time-series database for metrics storage and querying
- **Grafana** - Visualization dashboards and alerting
- **Alertmanager** - Alert routing and notifications (production only)
- **Prometheus Operator** - Kubernetes-native Prometheus management
- **ServiceMonitor CRDs** - Automatic service discovery for metrics scraping

**Key Features:**
- ✅ 100% runs in Kubernetes (no local installation required)
- ✅ Environment-specific configurations (dev/prod)
- ✅ Automatic metric collection via ServiceMonitors
- ✅ Pre-built Kubernetes dashboards + custom RealWorld dashboards
- ✅ Production-grade alerting rules

### Installation

#### Development Environment
```bash
# 1. Add Prometheus Helm repository (one-time setup)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 2. Install kube-prometheus-stack
helm install monitoring prometheus-community/kube-prometheus-stack \
  -f helm/monitoring/values-dev.yaml \
  -n monitoring --create-namespace

# 3. Wait for all pods to be ready
kubectl wait --for=condition=ready pod --all -n monitoring --timeout=300s

# 4. Deploy/upgrade RealWorld application with monitoring enabled
helm upgrade --install realworld ./helm/realworld \
  -f helm/realworld/values.yaml \
  -f helm/realworld/values-dev.yaml

# 5. Access Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3001:80
# Open browser: http://localhost:3001
# Login: admin / admin
```

#### Production Environment
```bash
# 1. Add Prometheus Helm repository (if not already added)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 2. Install kube-prometheus-stack with production configuration
helm install monitoring prometheus-community/kube-prometheus-stack \
  -f helm/monitoring/values-prod.yaml \
  --set grafana.adminPassword="$GRAFANA_ADMIN_PASSWORD" \
  -n monitoring --create-namespace

# 3. Wait for all pods to be ready
kubectl wait --for=condition=ready pod --all -n monitoring --timeout=600s

# 4. Deploy/upgrade RealWorld application
helm upgrade --install realworld ./helm/realworld \
  -f helm/realworld/values.yaml \
  -f helm/realworld/values-prod.yaml \
  -f helm/realworld/values-local-secrets.yaml

# 5. Access Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3001:80
# Open browser: http://localhost:3001
```

### Accessing Monitoring

**Method 1: Port Forwarding (Recommended for Development)**
```bash
# Access Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3001:80
# Visit: http://localhost:3001

# Access Prometheus (optional)
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
# Visit: http://localhost:9090

# Access Alertmanager (production only)
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-alertmanager 9093:9093
# Visit: http://localhost:9093
```

**Method 2: Ingress (Production)**
```yaml
# Uncomment ingress section in helm/monitoring/values-prod.yaml
grafana:
  ingress:
    enabled: true
    hosts:
    - grafana.your-domain.com
```

### Available Dashboards

**Pre-built Kubernetes Dashboards (20+):**
- Kubernetes / Compute Resources / Cluster
- Kubernetes / Compute Resources / Namespace (Pods)
- Kubernetes / Compute Resources / Pod
- Kubernetes / Networking / Cluster
- Node Exporter / Nodes
- Prometheus / Overview

**Custom RealWorld Dashboards:**
1. **RealWorld - Application Overview**
   - Requests per second
   - API response time (p50, p95, p99 latency)
   - Error rate (5xx responses)
   - HTTP requests by status code
   - MongoDB connection status
   - Ready pods count

### Metrics Exposed

**Backend API Metrics** (`/metrics` endpoint on port 4000):
- `http_request_duration_seconds` - HTTP request latency histogram
- `http_requests_total` - Total HTTP requests counter
- `mongodb_connection_status` - MongoDB connection status (1=connected, 0=disconnected)
- `nodejs_*` - Node.js runtime metrics (CPU, memory, event loop, GC)
- `realworld_active_users_total` - Total registered users
- `realworld_article_operations_total` - Article operations (create, update, delete, favorite)
- `realworld_comment_operations_total` - Comment operations (create, delete)
- `realworld_auth_operations_total` - Authentication operations (login, register)

**MongoDB Metrics** (via Percona MongoDB Exporter on port 9216, production only):
- `mongodb_connections` - Current MongoDB connections
- `mongodb_op_counters_total` - MongoDB operation counters
- `mongodb_memory` - MongoDB memory usage
- And 100+ more MongoDB-specific metrics

### Alerting Rules (Production Only)

**Backend Alerts:**
- **RealWorldHighErrorRate** - 5xx error rate > 5% for 5 minutes
- **RealWorldHighLatency** - p95 latency > 1 second for 5 minutes

**MongoDB Alerts:**
- **RealWorldMongoDBDown** - MongoDB connection status = 0 for 2 minutes
- **RealWorldMongoDBHighConnections** - Active connections > 100 for 5 minutes

**Resource Alerts:**
- **RealWorldHighMemoryUsage** - Memory usage > 90% of limit for 5 minutes
- **RealWorldHighCPUUsage** - CPU usage > 80% of limit for 5 minutes
- **RealWorldPodNotReady** - Pod not ready for 5 minutes
- **RealWorldPodRestarting** - Pod restarts > 3 in 1 hour

### Environment Comparison

| Feature | Development | Production |
|---------|-------------|------------|
| **Prometheus Replicas** | 1 | 2 (HA) |
| **Prometheus Retention** | 7 days | 30 days |
| **Prometheus Storage** | Ephemeral | 50Gi persistent |
| **Grafana Replicas** | 1 | 2 (HA) |
| **Grafana Persistence** | No | 10Gi persistent |
| **Alertmanager** | Disabled | 3 replicas (clustered) |
| **Node Exporter** | Disabled | Enabled |
| **MongoDB Exporter** | Disabled | Enabled |
| **Scrape Interval** | 30s | 15s |
| **Alerts** | Disabled | Enabled |

### Daily Monitoring Access

**Access Grafana:**
```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3001:80
# Open browser: http://localhost:3001
# Login: admin / [password from values-local-secrets.yaml]
```

**Access Prometheus (for troubleshooting):**
```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
# Open browser: http://localhost:9090
```

**View Backend Metrics Directly:**
```bash
kubectl port-forward -n realworld svc/backend 4000:4000
curl http://localhost:4000/metrics
```

### Troubleshooting Monitoring

**Metrics not appearing in Prometheus:**
```bash
# 1. Check ServiceMonitor is created
kubectl get servicemonitor -n realworld

# 2. Check Prometheus targets health
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
# Visit: http://localhost:9090/targets
# Look for realworld/backend and realworld/mongodb targets (should show "UP")

# 3. Verify NetworkPolicy allows monitoring namespace
kubectl get networkpolicy -n realworld -o yaml
# Must include ingress rule for kubernetes.io/metadata.name: monitoring

# 4. Test connectivity from Prometheus to backend
kubectl exec -n monitoring prometheus-monitoring-kube-prometheus-prometheus-0 -c prometheus -- \
  wget -O- --timeout=5 http://[BACKEND_POD_IP]:4000/metrics
```

**Grafana dashboard not updating:**
```bash
# 1. Check ConfigMap exists
kubectl get configmap -n monitoring | grep grafana-dashboard

# 2. Restart Grafana to reload dashboards
kubectl rollout restart deployment/monitoring-grafana -n monitoring

# 3. Wait 1-2 minutes for pods to restart, then refresh browser
```

**Prometheus using too much memory:**
```bash
# Reduce retention in values file
prometheus:
  prometheusSpec:
    retention: 3d  # Reduce from 7d or 30d
    retentionSize: 5GB  # Reduce from 10GB or 50GB

# Upgrade the release
helm upgrade monitoring prometheus-community/kube-prometheus-stack \
  -f helm/monitoring/values-dev.yaml -n monitoring
```

### Uninstalling Monitoring

```bash
# Remove monitoring stack
helm uninstall monitoring -n monitoring

# Remove monitoring namespace (optional)
kubectl delete namespace monitoring

# Note: RealWorld application will continue to work without monitoring
```

### Example Prometheus Queries

**API Request Rate:**
```promql
sum(rate(http_requests_total{namespace="realworld"}[5m]))
```

**p95 Latency:**
```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="realworld"}[5m])) by (le))
```

**Error Rate:**
```promql
sum(rate(http_requests_total{namespace="realworld",status_code=~"5.."}[5m])) / sum(rate(http_requests_total{namespace="realworld"}[5m]))
```

**MongoDB Connection Status:**
```promql
mongodb_connection_status{namespace="realworld"}
```

**Pod Memory Usage:**
```promql
container_memory_working_set_bytes{namespace="realworld",pod=~"backend-.*"} / container_spec_memory_limit_bytes{namespace="realworld",pod=~"backend-.*"}
```

## Environment Variables Required
- `DATABASE_URI` - MongoDB connection string
- `access_token_secret` - JWT signing secret
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (defaults to 4000)