# CI/CD Specification Document

**Project:** RealWorld - React/Express/MongoDB Application
**Date:** 2025-10-29
**Version:** 1.1
**Status:** Approved for Implementation

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Branch Strategy (GitFlow)](#branch-strategy-gitflow)
3. [CI/CD Workflow Structure](#cicd-workflow-structure)
4. [Image Building & Tagging Strategy](#image-building--tagging-strategy)
5. [Security Scanning](#security-scanning)
6. [Quality Gates](#quality-gates)
7. [Deployment Strategy](#deployment-strategy)
8. [Environments](#environments)
9. [Workflow Files](#workflow-files)
10. [Configuration Files](#configuration-files)
11. [Optimizations](#optimizations)
12. [Release Process](#release-process)
13. [Directory Structure](#directory-structure)

---

## Architecture Overview

### **CI/CD Strategy**
- **Methodology:** GitFlow (Option C)
- **Workflow Organization:** Modular (5 separate workflow files)
- **Container Registry:** GitHub Container Registry (ghcr.io)
- **Deployment Target:** Azure Kubernetes Service (AKS)
- **Kubernetes Strategy:** Same cluster, different namespaces

### **Key Principles**
- Security is the highest priority
- Only tested code reaches develop/main branches
- Automated quality gates prevent broken code from merging
- Manual approval required for production deployments
- Efficient resource usage (caching, parallelization, path filtering)

---

## Branch Strategy (GitFlow)

### **Branch Types**

#### **1. Feature Branches (`feature/*`)**
- **Purpose:** Work in progress, active development
- **Created from:** `develop`
- **Merged to:** `develop`
- **CI Triggers:** None (no CI runs on push to feature branches)
- **Developer Workflow:**
  - Develop locally using `docker-compose.dev.yml`
  - Test locally before creating PR
  - Push commits freely without waiting for CI

#### **2. Develop Branch (`develop`)**
- **Purpose:** Pre-production integration branch
- **Auto-deploys to:** Staging environment
- **CI Triggers:**
  - Full CI on push (lint, test, security, build, push images, deploy)
  - Full CI on PR from feature branches
- **Protection Rules:**
  - Require PR approval (1 reviewer)
  - Require all CI checks to pass
  - No direct commits allowed

#### **3. Main Branch (`main`)**
- **Purpose:** Production-only branch (sacred)
- **Auto-deploys to:** Production environment (with manual approval)
- **CI Triggers:**
  - Full CI on push (lint, test, security, build, push images)
  - Production deployment requires manual approval
  - Auto-create GitHub Release with changelog
- **Protection Rules:**
  - Require PR approval (1 reviewer)
  - Require all CI checks to pass
  - Only merge from `develop` branch
  - No direct commits allowed

### **Workflow Flow**

```
Developer creates feature branch from develop
         ↓
Work locally (docker-compose.dev.yml) - No CI runs
         ↓
Create PR: feature/* → develop
         ↓
CI runs (lint, test, security, build) - Quality gate
         ↓
Code review + approval
         ↓
Merge to develop
         ↓
CI runs + push images + auto-deploy to staging
         ↓
QA team tests in staging (days/weeks)
         ↓
Create PR: develop → main
         ↓
CI runs (validation) - Quality gate
         ↓
Code review + approval
         ↓
Merge to main
         ↓
CI runs + push production images + create release
         ↓
Manual approval required (GitHub Environment)
         ↓
Deploy to production
```

---

## CI/CD Workflow Structure

### **Workflow Trigger Strategy**

#### **When CI Runs:**
- ✅ Pull requests to `develop` or `main`
- ✅ Push to `develop` branch
- ✅ Push to `main` branch
- ❌ Push to `feature/*` branches (no CI)

#### **What Gets Built:**
- ✅ PR opened/updated: Build images (test only, no push to registry)
- ✅ Merge to `develop`: Build + push images with `develop` tags
- ✅ Merge to `main`: Build + push images with semantic version tags

### **Job Dependencies**

```
Parallel Execution (Stage 1):
├── lint-backend
├── lint-frontend
├── test-backend
├── security-secrets
├── security-dependencies
└── security-sast

↓ (All must pass)

Parallel Execution (Stage 2 - Build locally, no push):
├── build-backend (depends on: lint-backend, test-backend, security-*)
└── build-frontend (depends on: lint-frontend, security-*)

↓ (Builds must complete)

Parallel Execution (Stage 3 - Scan before push):
├── scan-backend (Trivy scan local backend image)
└── scan-frontend (Trivy scan local frontend image)

↓ (Scans must pass - security gate)

Sequential Execution (Stage 4 - Push only if scans passed):
└── push-images (Only on develop/main branches)

↓ (Only on develop/main push)

Sequential Execution (Stage 5):
└── deploy (staging or production based on branch)
```

---

## Image Building & Tagging Strategy

### **Build Strategy: Option 2 (PR + Branch Merges)**

#### **What Gets Built When:**

| Event | CI Runs? | Build? | Push to Registry? | Tags Created |
|-------|----------|--------|-------------------|--------------|
| Push to feature/* | ❌ No | ❌ No | ❌ No | None |
| Open PR to develop | ✅ Yes | ✅ Yes | ❌ No | None (test only) |
| Update PR commit | ✅ Yes | ✅ Yes | ❌ No | None (test only) |
| Merge to develop | ✅ Yes | ✅ Yes | ✅ Yes | `develop`, `develop-{sha}` |
| Open PR to main | ✅ Yes | ✅ Yes | ❌ No | None (test only) |
| Merge to main | ✅ Yes | ✅ Yes | ✅ Yes | `{version}`, `{version}-{sha}`, `main`, `latest` |

### **Image Tagging Convention**

#### **For `develop` branch:**
```
ghcr.io/jjuuniper/medium_react-express-mongo/backend:develop
ghcr.io/jjuuniper/medium_react-express-mongo/backend:develop-abc123d
ghcr.io/jjuuniper/medium_react-express-mongo/frontend:develop
ghcr.io/jjuuniper/medium_react-express-mongo/frontend:develop-abc123d
```

#### **For `main` branch:**
```
ghcr.io/jjuuniper/medium_react-express-mongo/backend:1.2.3
ghcr.io/jjuuniper/medium_react-express-mongo/backend:1.2.3-abc123d
ghcr.io/jjuuniper/medium_react-express-mongo/backend:main
ghcr.io/jjuuniper/medium_react-express-mongo/backend:latest

ghcr.io/jjuuniper/medium_react-express-mongo/frontend:1.2.3
ghcr.io/jjuuniper/medium_react-express-mongo/frontend:1.2.3-abc123d
ghcr.io/jjuuniper/medium_react-express-mongo/frontend:main
ghcr.io/jjuuniper/medium_react-express-mongo/frontend:latest
```

### **Semantic Versioning**

**Convention:** Semantic Versioning (SemVer) with Conventional Commits

**Commit Message Format:**
```
feat: Add user profile endpoint       → Minor bump (1.2.3 → 1.3.0)
fix: Correct login validation         → Patch bump (1.2.3 → 1.2.4)
feat!: Redesign authentication API    → Major bump (1.2.3 → 2.0.0)
docs: Update README                   → No version bump
chore: Update dependencies            → No version bump
```

**Automated Versioning:**
- Tool: `semantic-release`
- Analyzes commit messages since last release
- Automatically bumps version number
- Creates Git tag (e.g., `v1.2.3`)
- Generates changelog from commits
- Creates GitHub Release

---

## Security Scanning

### **Security Tools (All Enabled)**

#### **1. Secret Scanning**
- **Tool:** TruffleHog
- **What it detects:** API keys, passwords, tokens, credentials in code
- **When it runs:** Every CI execution
- **Scope:** Full repository history
- **Exclusions:** `.env.example` (demo values only)
- **Action on failure:** Block PR merge

#### **2. Dependency Scanning**
- **Tools:** npm audit + Dependabot
- **npm audit:**
  - Runs on every CI execution
  - Scans `package-lock.json` for known CVEs
  - Fails on HIGH or CRITICAL vulnerabilities
  - Action: Block PR merge
- **Dependabot:**
  - Runs weekly (every Monday 9:00 AM)
  - Creates PRs for vulnerable dependencies
  - Scans backend, frontend, Docker images, GitHub Actions
  - Action: Notify via PR, manual review required

#### **3. Static Application Security Testing (SAST)**
- **Tool:** Semgrep
- **What it detects:**
  - SQL injection vulnerabilities
  - XSS (Cross-Site Scripting)
  - Hardcoded secrets
  - Insecure crypto usage
  - Authentication bypass patterns
- **Rulesets:**
  - `p/security-audit`
  - `p/nodejs`
  - `p/react`
  - `p/docker`
- **When it runs:** Every CI execution
- **Action on failure:** Block PR merge

#### **4. Docker Image Scanning**
- **Tool:** Trivy
- **What it detects:**
  - OS package vulnerabilities
  - Application dependency CVEs
  - Misconfigurations in Dockerfile
  - Exposed secrets in image layers
- **Severity levels:** CRITICAL, HIGH
- **When it runs:** After images are built locally, BEFORE pushing to registry
- **Purpose:** Security gate to prevent vulnerable images from reaching registry
- **Integration:** Results uploaded to GitHub Security tab (SARIF format)
- **Action on failure:** Block CI, prevent image push, block PR merge

#### **5. Software Bill of Materials (SBOM)**
- **Generation:** Automatic via Trivy
- **Format:** SPDX or CycloneDX
- **Purpose:** Compliance, security auditing
- **Storage:** GitHub Security artifacts

### **Dependabot Configuration**

**Weekly scans for:**
- Backend npm dependencies
- Frontend npm dependencies
- Docker base images (node:18-alpine)
- GitHub Actions versions

**Settings:**
- Maximum 5 open PRs per ecosystem
- Auto-assign to: @jjuuniper
- Labels: `dependencies`, `security`
- Auto-merge: Disabled (manual review required)

---

## Quality Gates

### **Code Quality Requirements**

#### **1. Linting (Backend + Frontend)**
- **Backend:** ESLint (standard Node.js rules)
- **Frontend:** ESLint + Prettier (Next.js recommended config)
- **Enforcement:** CI fails on any linting errors
- **Action:** Block PR merge until fixed

#### **2. Test Coverage**
- **Tool:** Jest with coverage reporting
- **Minimum threshold:** 80% line coverage
- **Enforcement:** CI fails if coverage drops below 80%
- **Coverage check:**
  ```bash
  COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
  if (( $(echo "$COVERAGE < 80" | bc -l) )); then
    exit 1
  fi
  ```
- **Action:** Block PR merge

#### **3. TypeScript Type Checking (Frontend)**
- **Tool:** TypeScript compiler (tsc)
- **Enforcement:** CI fails on type errors
- **Action:** Block PR merge

#### **4. All Security Scans**
- Must pass: Secret scanning, dependency scanning, SAST
- Action: Block PR merge

### **Pull Request Requirements**

**To merge PR to `develop` or `main`:**
- ✅ All CI checks pass (lint, test, security, build)
- ✅ Code coverage ≥ 80%
- ✅ 1 approval from reviewer
- ✅ No merge conflicts
- ✅ Branch up-to-date with target

---

## Deployment Strategy

### **Staging Deployment (Automatic)**

**Trigger:** Push to `develop` branch (after CI passes)

**Process:**
1. CI builds and pushes images with `develop` tags
2. Deployment workflow triggers automatically (`workflow_run`)
3. Helm upgrade using `values-staging.yaml`
4. Deploy to `realworld-staging` namespace in AKS
5. Wait for rollout completion
6. Health checks verify deployment
7. Staging environment updated

**Configuration:**
- **Environment:** staging (GitHub Environment)
- **Protection rules:** None (auto-deploy)
- **Namespace:** `realworld-staging`
- **Image tags:** `develop-{sha}`
- **Helm values:** `infrastructure/helm/realworld/values-staging.yaml`

### **Production Deployment (Manual Approval)**

**Trigger:** Manual workflow dispatch after merge to `main`

**Process:**
1. CI builds and pushes images with version tags
2. Production deployment workflow available for manual trigger
3. 🛑 Manual approval required (GitHub Environment protection)
4. Authorized reviewer approves deployment
5. Helm upgrade using `values-prod.yaml`
6. Deploy to `realworld-production` namespace in AKS
7. Wait for rollout completion
8. Health checks verify deployment
9. Monitor metrics (Prometheus/Grafana)

**Configuration:**
- **Environment:** production (GitHub Environment)
- **Protection rules:**
  - Required reviewers: @jjuuniper (+ additional reviewers)
  - Wait timer: 0 minutes (optional: add delay)
  - Deployment branches: `main` only
- **Namespace:** `realworld-production`
- **Image tags:** `{version}` (e.g., `1.2.3`)
- **Helm values:** `infrastructure/helm/realworld/values-prod.yaml`

---

## Environments

### **Cluster Architecture**

**Strategy:** Same AKS cluster, different namespaces

```
Azure Kubernetes Service (AKS) Cluster: "realworld-cluster"
├── Namespace: realworld-staging
│   ├── Backend (1 replica)
│   ├── Frontend (1 replica)
│   ├── MongoDB StatefulSet
│   └── Resources: Small (cost-effective)
│
└── Namespace: realworld-production
    ├── Backend (3 replicas)
    ├── Frontend (3 replicas)
    ├── MongoDB StatefulSet
    └── Resources: Large (performance)
```

### **Environment Configuration**

| Aspect | Staging | Production |
|--------|---------|------------|
| **Namespace** | `realworld-staging` | `realworld-production` |
| **Backend Replicas** | 1 | 3 |
| **Frontend Replicas** | 1 | 3 |
| **MongoDB Storage** | 10Gi | 50Gi |
| **Resource Limits** | Lower (cost) | Higher (performance) |
| **Auto-Deploy** | Yes (from develop) | No (manual approval) |
| **Secrets** | Demo values | Azure Key Vault |
| **Monitoring** | Shared Prometheus | Shared Prometheus |
| **NetworkPolicy** | Disabled | Enabled |

### **Kubernetes Connection**

**Method:** KUBECONFIG stored as GitHub Secret

**Secrets Required:**
- `KUBECONFIG_STAGING` - Kubeconfig for staging namespace
- `KUBECONFIG_PRODUCTION` - Kubeconfig for production namespace

**Alternative (Azure-native):**
- Azure Service Principal credentials
- Use `az aks get-credentials` in workflows

---

## Workflow Files

### **Modular Structure (5 Workflow Files)**

#### **1. `.github/workflows/ci.yml`**
**Purpose:** Core CI pipeline (build, test, security)

**Triggers:**
- Pull requests to `develop` or `main`
- Push to `develop` or `main`

**Jobs:**
1. `lint-backend` - ESLint backend code
2. `lint-frontend` - ESLint + Prettier frontend code
3. `test-backend` - Jest tests with coverage (80% threshold)
4. `typecheck-frontend` - TypeScript type checking
5. `security-secrets` - TruffleHog secret scanning
6. `security-dependencies` - npm audit (backend + frontend)
7. `security-sast` - Semgrep static analysis
8. `build-backend` - Build backend Docker image locally (no push)
9. `build-frontend` - Build frontend Docker image locally (no push)
10. `scan-backend` - Trivy vulnerability scan of local backend image
11. `scan-frontend` - Trivy vulnerability scan of local frontend image
12. `push-images` - Push images to ghcr.io (only if scans passed, only on develop/main)

**Dependencies:**
- Build jobs depend on: lint, test, security jobs
- Scan jobs depend on: build jobs
- Push job depends on: scan jobs (security gate)

**Outputs:**
- Docker images pushed to ghcr.io (only if scans pass, only on `develop`/`main`)
- Coverage reports
- Security scan results (uploaded to GitHub Security)
- SARIF reports for Trivy scans

---

#### **2. `.github/workflows/deploy-staging.yml`**
**Purpose:** Auto-deploy to staging environment

**Triggers:**
- `workflow_run` - Runs after `ci.yml` completes successfully on `develop` branch

**Jobs:**
1. `deploy-staging`
   - Setup kubectl with KUBECONFIG
   - Helm upgrade to staging namespace
   - Wait for rollout completion
   - Verify health checks

**Environment:** staging (GitHub Environment)

**Helm Command:**
```bash
helm upgrade --install realworld ./infrastructure/helm/realworld \
  -f infrastructure/helm/realworld/values.yaml \
  -f infrastructure/helm/realworld/values-staging.yaml \
  --set backend.image.tag=develop-${GITHUB_SHA} \
  --set frontend.image.tag=develop-${GITHUB_SHA} \
  --namespace realworld-staging \
  --wait
```

---

#### **3. `.github/workflows/deploy-production.yml`**
**Purpose:** Manual production deployment with approval

**Triggers:**
- `workflow_dispatch` - Manual trigger only (with image tag input)

**Jobs:**
1. `deploy-production`
   - 🛑 Manual approval required (GitHub Environment protection)
   - Setup kubectl with KUBECONFIG
   - Helm upgrade to production namespace
   - Wait for rollout completion
   - Verify health checks
   - Post deployment notification

**Environment:** production (GitHub Environment with required reviewers)

**Helm Command:**
```bash
helm upgrade --install realworld ./infrastructure/helm/realworld \
  -f infrastructure/helm/realworld/values.yaml \
  -f infrastructure/helm/realworld/values-prod.yaml \
  --set backend.image.tag=${VERSION} \
  --set frontend.image.tag=${VERSION} \
  --namespace realworld-production \
  --wait
```

---

#### **4. `.github/workflows/pr-checks.yml`**
**Purpose:** PR-specific validations

**Triggers:**
- Pull requests (opened, synchronized, reopened)

**Jobs:**
1. `pr-title-check` - Validate conventional commit format
2. `pr-size-check` - Warn if PR exceeds 500 lines
3. `coverage-comment` - Post coverage report as PR comment
4. `security-summary` - Post security scan summary as PR comment

---

#### **5. `.github/workflows/release.yml`**
**Purpose:** Auto-create releases on main branch

**Triggers:**
- Push to `main` branch

**Jobs:**
1. `release`
   - Checkout with full git history
   - Run semantic-release
   - Auto-bump version based on conventional commits
   - Create git tag (e.g., `v1.2.3`)
   - Generate changelog from commits
   - Create GitHub Release with changelog

**Tool:** `semantic-release` with plugins:
- `@semantic-release/commit-analyzer`
- `@semantic-release/release-notes-generator`
- `@semantic-release/changelog`
- `@semantic-release/github`
- `@semantic-release/git`

---

## Configuration Files

### **Files to Create**

#### **1. Backend ESLint Configuration**

**File:** `backend/.eslintrc.json`
```json
{
  "env": {
    "node": true,
    "es2021": true,
    "jest": true
  },
  "extends": ["eslint:recommended"],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": ["warn", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }],
    "no-console": "off",
    "semi": ["error", "always"],
    "quotes": ["error", "single", { "avoidEscape": true }]
  },
  "ignorePatterns": ["node_modules/", "coverage/", "dist/"]
}
```

**File:** `backend/.eslintignore`
```
node_modules/
coverage/
dist/
*.test.js
tests/
```

---

#### **2. Dependabot Configuration**

**File:** `.github/dependabot.yml`
```yaml
version: 2
updates:
  # Backend npm dependencies
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 5
    reviewers:
      - "jjuuniper"
    labels:
      - "dependencies"
      - "security"
    versioning-strategy: increase

  # Frontend npm dependencies
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 5
    reviewers:
      - "jjuuniper"
    labels:
      - "dependencies"
      - "security"

  # Backend Docker base images
  - package-ecosystem: "docker"
    directory: "/backend"
    schedule:
      interval: "monthly"

  # Frontend Docker base images
  - package-ecosystem: "docker"
    directory: "/frontend"
    schedule:
      interval: "monthly"

  # GitHub Actions versions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

---

#### **3. Setup Documentation**

**File:** `CICD_SETUP.md`

**Contents:**
- Architecture overview
- GitHub repository setup instructions
- GitHub Secrets configuration
- GitHub Environments setup (staging, production)
- Branch protection rules
- Azure AKS connection setup
- Testing the CI/CD pipeline
- Troubleshooting guide

---

### **Files to Modify**

#### **1. Backend package.json**

**Add to scripts:**
```json
{
  "scripts": {
    "start": "node server",
    "dev": "nodemon server",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

**Add to devDependencies:**
```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.3.0",
    "nodemon": "^2.0.20",
    "eslint": "^8.57.0"
  }
}
```

---

#### **2. Helm Values File Rename**

**Action:** Rename `helm/realworld/values-dev.yaml` to `infrastructure/helm/realworld/values-staging.yaml`

**Update references in:**
- CLAUDE.md
- All deployment documentation
- Workflow files (deploy-staging.yml)

---

#### **3. CLAUDE.md**

**Add new section:** CI/CD Pipeline

**Contents:**
- GitFlow branch strategy
- Workflow structure overview
- How to trigger deployments
- Image tagging conventions
- Security scanning details
- Quality gates and PR requirements
- Troubleshooting CI/CD issues

---

## Optimizations

### **1. Docker Layer Caching**

**Implementation:** GitHub Actions cache

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**Benefit:** Subsequent builds 3-5x faster (5 min → 1-2 min)

---

### **2. npm Dependency Caching**

**Implementation:** actions/setup-node with cache

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'npm'
    cache-dependency-path: backend/package-lock.json
```

**Benefit:** npm install 2-3x faster

---

### **3. Path-Based Filtering**

**Implementation:** Workflow triggers with path filters

```yaml
on:
  push:
    branches: [develop, main]
    paths:
      - 'backend/**'
      - 'frontend/**'
      - 'infrastructure/**'
      - '.github/workflows/**'
      - 'docker-compose*.yml'
```

**Benefit:** CI doesn't run for documentation-only changes

**Excluded paths:**
- `README.md`
- `CLAUDE.md`
- `docs/**`
- `*.md` (except in code directories)

---

### **4. Parallel Job Execution**

**Strategy:** Run independent jobs concurrently

```yaml
jobs:
  lint-backend:     # Runs in parallel
  lint-frontend:    # Runs in parallel
  test-backend:     # Runs in parallel
  security-scan:    # Runs in parallel

  build:
    needs: [lint-backend, lint-frontend, test-backend, security-scan]
```

**Benefit:** Total CI time reduced by 50-60%

---

### **5. Matrix Strategy for Multi-Service Builds**

**Implementation:**

```yaml
build:
  strategy:
    matrix:
      service: [backend, frontend]
  steps:
    - name: Build ${{ matrix.service }}
```

**Benefit:** Build both services in parallel

---

## Release Process

### **Conventional Commits**

**Format:** `<type>(<scope>): <description>`

**Types:**
- `feat:` - New feature (minor version bump)
- `fix:` - Bug fix (patch version bump)
- `feat!:` or `BREAKING CHANGE:` - Breaking change (major version bump)
- `docs:` - Documentation only (no version bump)
- `style:` - Code style changes (no version bump)
- `refactor:` - Code refactoring (no version bump)
- `test:` - Test changes (no version bump)
- `chore:` - Build/tooling changes (no version bump)

**Examples:**
```
feat: add user profile endpoint
fix: correct login validation logic
feat!: redesign authentication API
docs: update README with setup instructions
chore: update dependencies
```

---

### **Automated Release Workflow**

**Trigger:** Merge to `main` branch

**Steps:**
1. semantic-release analyzes commits since last release
2. Determines version bump (major, minor, patch)
3. Updates version in package.json
4. Creates git tag (e.g., `v1.2.3`)
5. Generates CHANGELOG.md from commits
6. Creates GitHub Release with:
   - Release notes (auto-generated from commits)
   - Changelog
   - Link to Docker images
   - Deployment instructions

**Output:**
- Git tag: `v1.2.3`
- GitHub Release: https://github.com/jjuuniper/medium_react-express-mongo/releases/tag/v1.2.3
- Docker images: `ghcr.io/.../backend:1.2.3`

---

### **Manual Production Deployment**

**Process:**
1. Review GitHub Release
2. Navigate to Actions → Deploy to Production
3. Click "Run workflow"
4. Enter version tag (e.g., `1.2.3`)
5. Wait for manual approval gate
6. Authorized reviewer approves deployment
7. Production deployment executes
8. Verify deployment in AKS

---

## Directory Structure

### **Final Project Structure**

```
medium_react-express-mongo/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    [NEW] Core CI pipeline
│   │   ├── deploy-staging.yml        [NEW] Auto-deploy to staging
│   │   ├── deploy-production.yml     [NEW] Manual prod deployment
│   │   ├── pr-checks.yml             [NEW] PR validations
│   │   └── release.yml               [NEW] Release automation
│   └── dependabot.yml                [NEW] Dependency updates
│
├── backend/
│   ├── api/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── tests/
│   ├── .eslintrc.json                [NEW] ESLint configuration
│   ├── .eslintignore                 [NEW] ESLint ignore patterns
│   ├── Dockerfile
│   ├── jest.config.js
│   ├── package.json                  [MODIFIED] Add lint scripts
│   └── server.js
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── .eslintrc.json
│   ├── .prettierrc
│   ├── Dockerfile
│   ├── next.config.js
│   ├── package.json
│   └── tsconfig.json
│
├── infrastructure/                   [NEW] Cloud infrastructure
│   ├── helm/                         [MOVED] from root
│   │   └── realworld/
│   │       ├── templates/
│   │       ├── Chart.yaml
│   │       ├── values.yaml
│   │       ├── values-staging.yaml   [RENAMED] from values-dev.yaml
│   │       └── values-prod.yaml
│   └── k8s/                          [MOVED] from root
│       ├── namespace.yaml
│       ├── backend/
│       ├── frontend/
│       └── mongodb/
│
├── docker-compose.yml                Local production-like testing
├── docker-compose.dev.yml            Local development
├── .env.example
├── .gitignore
├── CICD_SETUP.md                     [NEW] Setup instructions
├── CICD_SPECIFICATION.md             [NEW] This document
├── CLAUDE.md                         [MODIFIED] Add CI/CD section
└── README.md
```

---

## Implementation Checklist

### **Phase 1: Directory Restructuring**
- [ ] Create `infrastructure/` directory
- [ ] Move `helm/` to `infrastructure/helm/`
- [ ] Move `k8s/` to `infrastructure/k8s/`
- [ ] Rename `helm/realworld/values-dev.yaml` to `infrastructure/helm/realworld/values-staging.yaml`

### **Phase 2: Configuration Files**
- [ ] Create `backend/.eslintrc.json`
- [ ] Create `backend/.eslintignore`
- [ ] Modify `backend/package.json` (add lint scripts + eslint dependency)
- [ ] Create `.github/dependabot.yml`

### **Phase 3: CI/CD Workflows**
- [ ] Create `.github/workflows/ci.yml`
- [ ] Create `.github/workflows/deploy-staging.yml`
- [ ] Create `.github/workflows/deploy-production.yml`
- [ ] Create `.github/workflows/pr-checks.yml`
- [ ] Create `.github/workflows/release.yml`

### **Phase 4: Documentation**
- [ ] Create `CICD_SETUP.md`
- [ ] Update `CLAUDE.md` with CI/CD section
- [ ] Create this specification document: `CICD_SPECIFICATION.md`

### **Phase 5: GitHub Configuration**
- [ ] Create GitHub Secrets (KUBECONFIG_STAGING, KUBECONFIG_PRODUCTION)
- [ ] Create GitHub Environment: staging
- [ ] Create GitHub Environment: production (with required reviewers)
- [ ] Configure branch protection rules for `develop`
- [ ] Configure branch protection rules for `main`
- [ ] Enable GitHub Container Registry (ghcr.io) write permissions

### **Phase 6: Testing & Validation**
- [ ] Create `develop` branch if not exists
- [ ] Test CI on feature branch PR
- [ ] Test deployment to staging
- [ ] Test production deployment workflow (dry-run)
- [ ] Verify all security scans working
- [ ] Verify image builds and pushes
- [ ] Verify Helm deployments

---

## Success Criteria

### **CI/CD Pipeline is Successful When:**

1. ✅ Feature branch PR triggers full CI validation
2. ✅ All security scans pass (secrets, dependencies, SAST, Docker)
3. ✅ Code coverage is ≥ 80%
4. ✅ Linting passes for backend and frontend
5. ✅ Docker images build successfully
6. ✅ Images pushed to ghcr.io with correct tags
7. ✅ Merge to `develop` auto-deploys to staging
8. ✅ Staging deployment completes successfully
9. ✅ Merge to `main` creates GitHub Release
10. ✅ Production deployment requires manual approval
11. ✅ Production deployment completes successfully
12. ✅ Dependabot creates weekly PRs for vulnerabilities

---

## Maintenance & Support

### **Weekly Tasks**
- Review Dependabot PRs for security updates
- Monitor GitHub Security alerts
- Review staging deployment logs

### **Monthly Tasks**
- Review GitHub Actions usage (free tier: 2000 min/month)
- Update workflow versions (via Dependabot)
- Review and update security scanning rules

### **Quarterly Tasks**
- Review and update branch protection rules
- Audit GitHub Environment reviewers
- Review Helm chart versions
- Update Node.js base image versions

---

## Appendix

### **GitHub Secrets Required**

| Secret Name | Purpose | Example Value |
|-------------|---------|---------------|
| `KUBECONFIG_STAGING` | Staging cluster access | Base64-encoded kubeconfig |
| `KUBECONFIG_PRODUCTION` | Production cluster access | Base64-encoded kubeconfig |
| `GITHUB_TOKEN` | GitHub API access | Auto-provided by GitHub Actions |

### **GitHub Environments Required**

**Environment: staging**
- Protection rules: None (auto-deploy)
- Secrets: `KUBECONFIG_STAGING`
- Variables: `NAMESPACE=realworld-staging`

**Environment: production**
- Protection rules: Required reviewers (@jjuuniper)
- Secrets: `KUBECONFIG_PRODUCTION`
- Variables: `NAMESPACE=realworld-production`

### **Branch Protection Rules**

**Branch: develop**
- Require pull request before merging
- Require 1 approval
- Require status checks to pass: CI, lint, test, security
- Require branches to be up to date before merging
- Do not allow bypassing settings

**Branch: main**
- Require pull request before merging
- Require 1 approval
- Require status checks to pass: CI, lint, test, security
- Require branches to be up to date before merging
- Restrict pushes that create matching branches
- Do not allow bypassing settings

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-29 | Claude + User | Initial specification document |
| 1.1 | 2025-10-29 | Claude + User | Updated Trivy scanning to scan-before-push strategy (security gate) |

---

**END OF SPECIFICATION**
