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
- NEVER use emojis in project files

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
Edit `infrastructure/helm/realworld/templates/network-policy.yaml` and add:
```yaml
- from:
  - namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: [NEW_NAMESPACE]
```

**Note:** Dev has `networkPolicy.enabled: false` for easier local development. Always test NetworkPolicy changes in a production-like environment.

## Kubernetes Deployment

### Kubernetes Manifests (`infrastructure/k8s/`)
Raw Kubernetes YAML files for manual deployment:
```bash
# Build images with proper names
docker-compose build

# Deploy all components
kubectl apply -f infrastructure/k8s/namespace.yaml
kubectl apply -f infrastructure/k8s/secrets/secret-dev.yaml  # Demo secrets
kubectl apply -f infrastructure/k8s/mongodb/ infrastructure/k8s/backend/ infrastructure/k8s/frontend/
kubectl apply -f infrastructure/k8s/ingress.yaml

# Access application
kubectl port-forward -n realworld svc/frontend 3000:3000
```

### Helm Charts (`infrastructure/helm/realworld/`)
Templated deployments with environment-specific configurations:

#### Staging Deployment
```bash
# Build staging images first
docker build --target development -t realworld-backend:dev ./backend
docker build --target development -t realworld-frontend:dev ./frontend

# IMPORTANT: Pre-create namespace with Helm ownership labels
# This is required for proper Helm tracking and lifecycle management
kubectl create namespace realworld-staging
kubectl label namespace realworld-staging app.kubernetes.io/managed-by=Helm
kubectl annotate namespace realworld-staging \
  meta.helm.sh/release-name=realworld \
  meta.helm.sh/release-namespace=realworld-staging

# Deploy staging environment (1 replica each, demo secrets)
helm install realworld ./infrastructure/helm/realworld \
  -f ./infrastructure/helm/realworld/values-staging.yaml \
  -n realworld-staging

# Access application
kubectl port-forward svc/frontend 3000:3000 -n realworld-staging
# Visit: http://localhost:3000
```

#### Production Deployment
```bash
# Build production images first
docker build --target production -t realworld-backend:latest ./backend
docker build --target production -t realworld-frontend:latest ./frontend

# IMPORTANT: Pre-create namespace with Helm ownership labels
kubectl create namespace realworld-production
kubectl label namespace realworld-production app.kubernetes.io/managed-by=Helm
kubectl annotate namespace realworld-production \
  meta.helm.sh/release-name=realworld \
  meta.helm.sh/release-namespace=realworld-production

# Deploy production environment (3 replicas each, external secrets)
helm install realworld ./infrastructure/helm/realworld \
  -f ./infrastructure/helm/realworld/values.yaml \
  -f ./infrastructure/helm/realworld/values-prod.yaml \
  -f ./infrastructure/helm/realworld/values-local-secrets.yaml \
  -n realworld-production

# Access application
kubectl port-forward svc/frontend 3001:3000 -n realworld-production
# Visit: http://localhost:3001
```

### Environment Comparison

| Aspect | Staging | Production |
|--------|---------|------------|
| **Replicas** | 1 backend, 1 frontend | 3 backend, 3 frontend |
| **Images** | `:dev` (development stage) | `:latest` (production stage) |
| **Build Type** | Hot reload, dev server | Pre-built, optimized bundle |
| **Memory Limits** | Frontend (1Gi), MongoDB (512Mi) | Frontend (512Mi), MongoDB (1Gi) |
| **Startup Time** | Slower (on-demand compilation) | Fast (Ready in ~400ms) |
| **Secrets** | Demo values (values-staging.yaml) | External (values-local-secrets.yaml) |
| **Use Case** | Feature development, debugging | Performance testing, production-like |

### Image Configuration
- **Development**: Non-root users, devDependencies, hot reload, larger memory for compilation
- **Production**: Non-root users, optimized builds, minimal dependencies, faster startup
- **Security**: Both stages use non-root users and proper file ownership

### Secret Management
- **Staging**: Demo secrets in `values-staging.yaml` (safe to commit)
- **Production**: External secrets via local files or CI/CD environment variables
- **Security**: All production secrets protected by `.gitignore` patterns
- **StatefulSet DNS**: Uses `mongodb-0.mongodb` for headless service resolution

### Namespace Pre-Creation Pattern

**Why we pre-create namespaces:**
Helm requires the namespace specified in `-n` to exist before installation, even when the chart contains a namespace template. Pre-creating the namespace with Helm ownership labels allows the chart's namespace template to be properly tracked as part of the release.

**Benefits:**
- Namespace included in `helm get manifest` (full infrastructure visibility)
- Namespace has custom labels (environment, name) for organization
- `helm uninstall` removes everything including the namespace (complete lifecycle management)
- Proper Helm adoption of existing resources

**Technical Details:**
The namespace template ([templates/namespace.yaml](infrastructure/helm/realworld/templates/namespace.yaml)) creates the namespace resource with labels. By pre-creating the namespace with matching ownership annotations, Helm adopts it during installation rather than failing with "namespace not found."

### Deployment Workflow
```bash
# 1. Choose environment and build appropriate images
# Staging:
docker build --target development -t realworld-backend:dev ./backend
docker build --target development -t realworld-frontend:dev ./frontend

# Pre-create namespace with Helm ownership
kubectl create namespace realworld-staging
kubectl label namespace realworld-staging app.kubernetes.io/managed-by=Helm
kubectl annotate namespace realworld-staging \
  meta.helm.sh/release-name=realworld \
  meta.helm.sh/release-namespace=realworld-staging

helm install realworld ./infrastructure/helm/realworld \
  -f ./infrastructure/helm/realworld/values-staging.yaml \
  -n realworld-staging

# Production:
docker build --target production -t realworld-backend:latest ./backend
docker build --target production -t realworld-frontend:latest ./frontend

# Pre-create namespace with Helm ownership
kubectl create namespace realworld-production
kubectl label namespace realworld-production app.kubernetes.io/managed-by=Helm
kubectl annotate namespace realworld-production \
  meta.helm.sh/release-name=realworld \
  meta.helm.sh/release-namespace=realworld-production

helm install realworld ./infrastructure/helm/realworld \
  -f ./infrastructure/helm/realworld/values.yaml \
  -f ./infrastructure/helm/realworld/values-prod.yaml \
  -f ./infrastructure/helm/realworld/values-local-secrets.yaml \
  -n realworld-production

# 2. Verify deployment
kubectl get pods -n realworld-staging -w  # Staging
kubectl get pods -n realworld-production -w  # Production

# 3. Access application
kubectl port-forward svc/frontend 3000:3000 -n realworld-staging  # Staging
kubectl port-forward svc/frontend 3001:3000 -n realworld-production  # Production
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
# Option 1: Clean uninstall (removes namespace and all resources)
helm uninstall realworld -n realworld-staging  # Or -n realworld-production

# Note: helm uninstall removes ALL resources including the namespace (pods, services,
# deployments, secrets, PVCs, etc.). This is a complete cleanup.

# Then reinstall using the deployment workflow above (pre-create namespace, then install)

# Force image updates (rebuild images first, then upgrade)
helm upgrade realworld ./infrastructure/helm/realworld -f ./infrastructure/helm/realworld/values-<env>.yaml
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
  -f infrastructure/helm/monitoring/values-dev.yaml \
  -n monitoring --create-namespace

# 3. Wait for all pods to be ready
kubectl wait --for=condition=ready pod --all -n monitoring --timeout=300s

# 4. Deploy/upgrade RealWorld application with monitoring enabled
helm upgrade --install realworld ./infrastructure/helm/realworld \
  -f infrastructure/helm/realworld/values.yaml \
  -f infrastructure/helm/realworld/values-staging.yaml

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

# 2. (Option 1) Install kube-prometheus-stack with production configuration
helm install monitoring prometheus-community/kube-prometheus-stack \
  -f infrastructure/helm/monitoring/values-prod.yaml \
  -f infrastructure/helm/monitoring/values-local-secrets.yaml \
  -n monitoring --create-namespace

# (Option 2) Generates random admin password
helm install monitoring prometheus-community/kube-prometheus-stack \
  -f infrastructure/helm/monitoring/values-prod.yaml \
  --set grafana.adminPassword="$GRAFANA_ADMIN_PASSWORD" \
  -n monitoring --create-namespace

# 3. Wait for all pods to be ready
kubectl wait --for=condition=ready pod --all -n monitoring --timeout=600s

# 4. Deploy/upgrade RealWorld application
helm upgrade --install realworld ./infrastructure/helm/realworld \
  -f infrastructure/helm/realworld/values.yaml \
  -f infrastructure/helm/realworld/values-prod.yaml \
  -f infrastructure/helm/realworld/values-local-secrets.yaml

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
# Uncomment ingress section in infrastructure/helm/monitoring/values-prod.yaml
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
  -f infrastructure/helm/monitoring/values-dev.yaml -n monitoring
```

### Uninstalling Monitoring

```bash
# Remove monitoring stack
helm uninstall monitoring -n monitoring

# Remove monitoring namespace (optional)
kubectl delete namespace monitoring

# Note: RealWorld application will continue to work without monitoring
```

### Complete Teardown (Everything)

To completely remove all deployments and start fresh:

```bash
# 1. Remove RealWorld application
helm uninstall realworld -n realworld-staging
helm uninstall realworld -n realworld-production

# 2. Remove monitoring stack
helm uninstall monitoring -n monitoring
kubectl delete namespace monitoring # Note: This is required since helm does not remove namespace for third-party releases

# 3. Delete all namespaces (cascading delete of all resources)
kubectl delete namespace realworld-staging
kubectl delete namespace realworld-production

# 4. Verify cleanup
kubectl get namespaces | grep realworld
helm list -A
```

**Note:** Deleting namespaces is a cascading operation that removes ALL resources within them (pods, services, deployments, secrets, PVCs, etc.). This may take 30-60 seconds to complete.

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

## CI/CD Pipeline

### Architecture Overview

The project uses **GitHub Actions** for a comprehensive CI/CD pipeline following **GitFlow** branching strategy with automated security scanning, testing, and deployment.

**Branching Strategy:**
```
feature/* → develop → staging → main → production
    ↓          ↓                  ↓
  Local    Auto-deploy        Manual deploy
   Dev       (CI/CD)           (Approval)
```

### Branch Workflow

**Feature Branches (`feature/*`):**
- Local development only
- No CI/CD workflows run (to save CI minutes)
- Must create PR to `develop` to trigger CI

**Develop Branch:**
- Runs full CI pipeline (lint, test, security, build, scan)
- Builds and pushes Docker images with `develop` tags
- Auto-deploys to `realworld-staging` namespace on AKS
- No manual approval required

**Main Branch:**
- Runs full CI pipeline
- Builds and pushes Docker images with version tags
- Creates GitHub Releases with semantic versioning
- Generates CHANGELOG.md automatically
- Production deployment requires manual approval from @jjuuniper

### GitHub Actions Workflows

**1. CI Pipeline (`.github/workflows/ci.yml`)**

Triggers: Pull requests and pushes to `develop`/`main`

**Stage 1 - Quality & Security Checks (Parallel):**
- Backend linting (ESLint)
- Frontend linting (ESLint + Prettier)
- Backend testing (Jest with 80% coverage threshold)
- Frontend TypeScript type checking
- Secret scanning (TruffleHog - full history scan)
- Dependency scanning (npm audit - high severity)
- SAST scanning (Semgrep - security-audit, nodejs, react, docker)

**Stage 2 - Build Images (Parallel, Local Only):**
- Build backend Docker image
- Build frontend Docker image
- Images stored as artifacts (not pushed to registry yet)
- Docker layer caching enabled

**Stage 3 - Security Gate (Scan Before Push):**
- Trivy scan backend image (CRITICAL/HIGH = fail)
- Trivy scan frontend image (CRITICAL/HIGH = fail)
- Generate SBOMs (Software Bill of Materials)
- Upload results to GitHub Security tab
- **Critical**: Images only proceed if scans pass

**Stage 4 - Push Images (Only on develop/main):**
- Tag images appropriately:
  - `develop` branch: `develop`, `develop-{sha}`
  - `main` branch: `{version}`, `{version}-{sha}`, `main`, `latest`
- Push to GitHub Container Registry (ghcr.io)
- Only runs if all security scans pass

**2. Deploy Staging (`.github/workflows/deploy-staging.yml`)**

Triggers: After successful CI Pipeline run on `develop` branch

**Steps:**
- Connects to AKS using `KUBECONFIG_STAGING` secret
- Deploys to `realworld-staging` namespace using Helm
- Uses `values-staging.yaml` configuration
- Waits for pods to be ready (5 minute timeout)
- Runs basic health checks
- Posts deployment summary

**3. Deploy Production (`.github/workflows/deploy-production.yml`)**

Triggers: Manual workflow dispatch only

**Features:**
- Requires manual approval from @jjuuniper
- Input parameter: `version` (e.g., `1.0.0`)
- Validates version exists in registry before deploying
- Creates backup of current deployment
- Deploys to `realworld-production` namespace using Helm
- Runs smoke tests (health checks)
- Monitors deployment for 2 minutes
- **Auto-rollback on failure**

**4. PR Checks (`.github/workflows/pr-checks.yml`)**

Triggers: Pull request opened, edited, synchronized

**Checks:**
- PR title validation (Conventional Commits format)
- PR size check (warns if >500 lines changed)
- Test coverage report (posted as PR comment)
- Security scan summary (posted as PR comment)
- PR checklist reminder

**5. Release (`.github/workflows/release.yml`)**

Triggers: Push to `main` branch

**Features:**
- Uses `semantic-release` for automated versioning
- Follows Conventional Commits specification:
  - `feat:` → Minor version bump (0.1.0 → 0.2.0)
  - `fix:` → Patch version bump (0.1.0 → 0.1.1)
  - `BREAKING CHANGE:` → Major version bump (0.1.0 → 1.0.0)
- Generates `CHANGELOG.md` automatically
- Creates GitHub Release with release notes
- Updates `package.json` versions

**6. Dependabot (`.github/dependabot.yml`)**

**Automated dependency updates:**
- Backend npm dependencies (weekly, Monday 9 AM)
- Frontend npm dependencies (weekly, Monday 9 AM)
- Docker base images (monthly)
- GitHub Actions versions (monthly)
- Auto-assigns @jjuuniper as reviewer

### Security Features

**1. Scan-Before-Push Strategy**
- Docker images are built locally first
- Trivy scans for vulnerabilities
- Only images that pass scans are pushed to registry
- Prevents vulnerable images from reaching production

**2. Comprehensive Security Scanning**
- **TruffleHog**: Scans entire Git history for secrets
- **npm audit**: Detects vulnerable dependencies
- **Semgrep**: Static Application Security Testing (SAST)
- **Trivy**: Container image vulnerability scanning
- **SBOM Generation**: Tracks all software components

**3. Quality Gates**
- 80% minimum test coverage (enforced)
- All linters must pass (ESLint, Prettier)
- TypeScript type checking must pass
- All security scans must pass
- PR title must follow Conventional Commits

### Image Tagging Strategy

**Develop Branch:**
```
ghcr.io/jjuuniper/medium_react-express-mongo/backend:develop
ghcr.io/jjuuniper/medium_react-express-mongo/backend:develop-abc1234
ghcr.io/jjuuniper/medium_react-express-mongo/frontend:develop
ghcr.io/jjuuniper/medium_react-express-mongo/frontend:develop-abc1234
```

**Main Branch:**
```
ghcr.io/jjuuniper/medium_react-express-mongo/backend:1.2.3
ghcr.io/jjuuniper/medium_react-express-mongo/backend:1.2.3-abc1234
ghcr.io/jjuuniper/medium_react-express-mongo/backend:main
ghcr.io/jjuuniper/medium_react-express-mongo/backend:latest
```

### Deployment Workflow

**1. Create Feature Branch**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-new-feature

# Make changes
git add .
git commit -m "feat: Add new feature description"
git push origin feature/my-new-feature
```

**2. Create Pull Request to Develop**
- PR title must follow Conventional Commits (e.g., `feat: Add new feature`)
- All CI checks must pass
- Requires 1 approval
- PR checks will comment with coverage report and security summary

**3. Merge to Develop (Auto-Deploy to Staging)**
```bash
# After approval and CI passes
git checkout develop
git merge feature/my-new-feature
git push origin develop
```
- CI Pipeline runs automatically
- Images pushed with `develop` tags
- Auto-deploys to `realworld-staging` namespace

**4. Create Pull Request to Main (Production Release)**
```bash
# Create PR: develop → main
# After approval and CI passes, merge to main
```
- CI Pipeline runs
- Release workflow creates GitHub Release
- Images pushed with version tags
- CHANGELOG.md updated automatically

**5. Deploy to Production (Manual)**
```bash
# Go to GitHub Actions → Deploy to Production → Run workflow
# Select branch: main
# Enter version: 1.2.3 (from GitHub Release)
# Click "Run workflow"
# Wait for approval from @jjuuniper
```

### CI/CD Environment Variables

**GitHub Secrets Required:**
- `KUBECONFIG_STAGING` - Base64-encoded kubeconfig for staging namespace
- `KUBECONFIG_PRODUCTION` - Base64-encoded kubeconfig for production namespace
- `GITHUB_TOKEN` - Auto-provided by GitHub (no action needed)

**GitHub Environments:**
- **staging**: No protection rules, auto-deploy
- **production**: Requires approval from @jjuuniper

### Troubleshooting CI/CD

**CI Pipeline Fails on Trivy Scan:**
```bash
# Update base Docker images
# Check Dockerfile and update node:18-alpine to latest

# Update vulnerable npm packages
cd backend  # or frontend
npm audit fix
npm audit fix --force  # If needed
```

**Staging Deployment Fails:**
```bash
# Check pod logs
kubectl logs -n realworld-staging -l app.kubernetes.io/name=backend --tail=100

# Check pod events
kubectl get events -n realworld-staging --sort-by='.lastTimestamp'
```

**Production Deployment Stuck:**
- Go to GitHub Actions → Deploy to Production → Running workflow
- Click "Review deployments" button
- Select "production" environment
- Click "Approve and deploy"

**Coverage Below 80%:**
```bash
# Run coverage locally
cd backend
npm run test:coverage
open coverage/lcov-report/index.html

# Add more tests to increase coverage
```

### Documentation

- **CICD_SETUP.md**: Complete CI/CD setup guide with GitHub configuration
- **CICD_SPECIFICATION.md**: Technical specification and architectural decisions
- **CLAUDE.md**: This file (project overview and guidelines)

### Development Best Practices

**Commit Messages:**
- Use Conventional Commits format
- Examples:
  - `feat: Add user authentication`
  - `fix: Resolve database connection issue`
  - `docs: Update API documentation`
  - `chore: Update dependencies`

**Pull Requests:**
- Keep PRs focused and small (<500 lines if possible)
- Ensure all tests pass locally before pushing
- Run `npm run lint` and `npm test` before creating PR
- Add descriptive PR descriptions

**Testing:**
- Maintain 80% or higher test coverage
- Write unit tests for new features
- Update tests when modifying existing code

## Environment Variables Required
- `DATABASE_URI` - MongoDB connection string
- `access_token_secret` - JWT signing secret
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (defaults to 4000)