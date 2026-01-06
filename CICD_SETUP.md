# CI/CD Setup Guide

This guide provides step-by-step instructions for setting up the complete CI/CD pipeline for the RealWorld application.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [GitHub Repository Setup](#github-repository-setup)
- [Azure AKS Configuration](#azure-aks-configuration)
- [GitHub Secrets Configuration](#github-secrets-configuration)
- [GitHub Environments Setup](#github-environments-setup)
- [Branch Protection Rules](#branch-protection-rules)
- [Testing the CI/CD Pipeline](#testing-the-cicd-pipeline)
- [Workflow Reference](#workflow-reference)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### GitFlow Branching Strategy

```
feature/* → develop → staging → main → production
    ↓          ↓                  ↓
  Local    Auto-deploy        Manual deploy
   Dev       (CI/CD)           (Approval)
```

**Branch Strategy:**
- **`feature/*` branches**: Local development only, no CI runs
- **`develop` branch**: Runs full CI, auto-deploys to staging on success
- **`main` branch**: Runs full CI, creates releases, manual production deployment

### Workflow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       PR to develop/main                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    CI Pipeline (ci.yml)                     │
├─────────────────────────────────────────────────────────────┤
│ Stage 1: Parallel Quality & Security Checks                │
│  - Lint (backend/frontend)                                  │
│  - Test (80% coverage required)                             │
│  - TypeScript type checking                                 │
│  - Secret scanning (TruffleHog)                             │
│  - Dependency scanning (npm audit)                          │
│  - SAST (Semgrep)                                           │
├─────────────────────────────────────────────────────────────┤
│ Stage 2: Build Docker Images (Local, No Push)              │
│  - Build backend image                                      │
│  - Build frontend image                                     │
├─────────────────────────────────────────────────────────────┤
│ Stage 3: Security Gate (Scan Before Push)                  │
│  - Trivy scan backend (CRITICAL/HIGH = fail)                │
│  - Trivy scan frontend (CRITICAL/HIGH = fail)               │
│  - Generate SBOMs                                           │
├─────────────────────────────────────────────────────────────┤
│ Stage 4: Push Images (Only if scans pass & on develop/main)│
│  - Tag images appropriately                                 │
│  - Push to GitHub Container Registry                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
              ┌───────────────┴───────────────┐
              ↓                               ↓
    ┌──────────────────┐          ┌──────────────────┐
    │  Push to develop │          │  Push to main    │
    └──────────────────┘          └──────────────────┘
              ↓                               ↓
    ┌──────────────────┐          ┌──────────────────┐
    │ Deploy Staging   │          │ Create Release   │
    │ (auto)           │          │(semantic-release)│
    └──────────────────┘          └──────────────────┘
                                            ↓
                                  ┌──────────────────┐
                                  │ Deploy Production│
                                  │ (manual approval)│
                                  └──────────────────┘
```

### Image Tagging Strategy

**Develop Branch:**
- `develop`
- `develop-{sha}`

**Main Branch:**
- `{version}` (e.g., `1.2.3`)
- `{version}-{sha}` (e.g., `1.2.3-abc1234`)
- `main`
- `latest`

---

## Prerequisites

Before setting up CI/CD, ensure you have:

1. **GitHub Repository**
   - Admin access to the repository
   - GitHub Actions enabled

2. **Azure Kubernetes Service (AKS)**
   - Running AKS cluster
   - Two namespaces created:
     - `realworld-staging`
     - `realworld-production`
   - kubectl access with appropriate permissions

3. **Local Tools**
   - `kubectl` CLI installed
   - `az` CLI installed (for Azure)
   - `base64` utility (for encoding kubeconfig)

---

## GitHub Repository Setup

### 1. Configure Workflow Permissions

1. Go to repository **Settings → Actions → General**
2. Under **Workflow permissions**:

**Recommended (Secure) - Use Default Read-Only:**
   - ✅ **Read repository contents and packages permissions** (default)
   - This is the **secure option** - workflows use explicit permissions where needed
   - All workflows already have granular permissions defined

**Alternative (Less Secure) - Only if needed:**
   - ⚠️ **Read and write permissions**
   - Grants broad write access to all workflows by default
   - Only use if you encounter permission errors not resolved by explicit permissions

3. Click **Save**

**Security Note:** Our workflows follow the **principle of least privilege** with explicit permissions defined at the job level. Each job requests only the specific permissions it needs (e.g., `packages: write` for image pushing, `security-events: write` for SARIF uploads). Using the default read-only setting is more secure.

### 2. Enable GitHub Actions

1. Go to repository **Settings → Actions → General**
2. Under **Actions permissions**, select:
   - ✅ **Allow all actions and reusable workflows**
3. Click **Save**

---

## Kubernetes Cluster Configuration

You can use **either** a local Kubernetes cluster (for faster testing) **or** Azure AKS (for production-like environment). Start with local, then migrate to AKS when ready.

### Option A: Local Kubernetes Cluster (Recommended for Testing)

Perfect for validating CI/CD pipeline quickly without cloud costs.

**Supported Local Clusters:**
- **Docker Desktop** (easiest for Windows/Mac)
- **Minikube** (cross-platform)
- **Kind** (Kubernetes in Docker)
- **k3s/k3d** (lightweight)

#### 1. Setup Local Cluster (Docker Desktop Example)

**Install Docker Desktop:**
1. Download from https://www.docker.com/products/docker-desktop
2. Install and restart your computer
3. Open Docker Desktop
4. Go to **Settings → Kubernetes**
5. Check **✅ Enable Kubernetes**
6. Click **Apply & Restart**
7. Wait 2-5 minutes for Kubernetes to start

**Verify Installation:**
```bash
# Check cluster is running
kubectl cluster-info

# Should show:
# Kubernetes control plane is running at https://kubernetes.docker.internal:6443
```

#### 2. Create Namespaces (Local)

```bash
# Create staging namespace
kubectl create namespace realworld-staging

# Create production namespace
kubectl create namespace realworld-production

# Verify namespaces
kubectl get namespaces | grep realworld
```

#### 3. Generate KUBECONFIG for GitHub Actions (Local)

**For Staging:**
```bash
# Get current kubeconfig (already points to local cluster)
kubectl config view --flatten > kubeconfig-staging.yaml

# Verify it's pointing to local cluster
cat kubeconfig-staging.yaml | grep server
# Should show: server: https://kubernetes.docker.internal:6443

# Encode to base64 for GitHub Secret
cat kubeconfig-staging.yaml | base64 -w 0 > kubeconfig-staging-base64.txt

# On Windows (PowerShell):
# [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content kubeconfig-staging.yaml -Raw)))
```

**For Production:**
```bash
# Same process for production namespace
kubectl config view --flatten > kubeconfig-production.yaml
cat kubeconfig-production.yaml | base64 -w 0 > kubeconfig-production-base64.txt
```

#### 4. Make Local Cluster Accessible to GitHub Actions

**Critical:** GitHub Actions runners need to access your local cluster.

**Option 1: Use GitHub Self-Hosted Runner (Recommended)**
```bash
# Install self-hosted runner on your local machine
# Settings → Actions → Runners → New self-hosted runner
# Follow GitHub's installation instructions

# Benefits:
# - Runs on your local machine (direct access to Docker Desktop cluster)
# - No networking issues
# - Free for public/private repos
```

**Update Workflows to Use Self-Hosted Runner:**
```yaml
# In deploy-staging.yml and deploy-production.yml
runs-on: self-hosted  # Changed from: ubuntu-latest
```

**Option 2: Expose Cluster with ngrok (Quick Testing)**
```bash
# Install ngrok: https://ngrok.com/download
ngrok tcp 6443

# Copy the forwarding URL (e.g., tcp://0.tcp.ngrok.io:12345)
# Update kubeconfig server URL to use ngrok URL
# ⚠️ Not recommended for production - security risk!
```

**Option 3: Use GitHub-Hosted Runners + Tailscale/VPN**
- Connect GitHub-hosted runners to your local network via VPN
- More complex setup, not recommended for quick testing

#### 5. Test Local Deployment

```bash
# Deploy to local staging namespace
helm upgrade --install realworld ./infrastructure/helm/realworld \
  -f ./infrastructure/helm/realworld/values-staging.yaml \
  -n realworld-staging

# Verify pods are running
kubectl get pods -n realworld-staging

# Access application locally
kubectl port-forward -n realworld-staging svc/frontend 3000:3000
# Visit: http://localhost:3000
```

#### 6. Cleanup Local Resources (When Done Testing)

```bash
# Delete deployments
helm uninstall realworld -n realworld-staging
helm uninstall realworld -n realworld-production

# Delete namespaces
kubectl delete namespace realworld-staging
kubectl delete namespace realworld-production

# To fully reset local cluster (Docker Desktop):
# Settings → Kubernetes → Reset Kubernetes Cluster
```

---

### Option B: Azure AKS Configuration (Production)

### 1. Create Namespaces

```bash
# Create staging namespace
kubectl create namespace realworld-staging

# Create production namespace
kubectl create namespace realworld-production

# Verify namespaces
kubectl get namespaces | grep realworld
```

### 2. Generate KUBECONFIG Files

#### For Staging:

```bash
# Get current kubeconfig
kubectl config view --flatten > /tmp/kubeconfig-staging.yaml

# Create a service account for GitHub Actions (recommended for production)
kubectl create serviceaccount github-actions -n realworld-staging

# Create role binding
kubectl create rolebinding github-actions-admin \
  --clusterrole=admin \
  --serviceaccount=realworld-staging:github-actions \
  -n realworld-staging

# Encode kubeconfig to base64
cat /tmp/kubeconfig-staging.yaml | base64 -w 0 > /tmp/kubeconfig-staging-base64.txt
```

#### For Production:

```bash
# Get current kubeconfig
kubectl config view --flatten > /tmp/kubeconfig-production.yaml

# Create a service account for GitHub Actions
kubectl create serviceaccount github-actions -n realworld-production

# Create role binding
kubectl create rolebinding github-actions-admin \
  --clusterrole=admin \
  --serviceaccount=realworld-production:github-actions \
  -n realworld-production

# Encode kubeconfig to base64
cat /tmp/kubeconfig-production.yaml | base64 -w 0 > /tmp/kubeconfig-production-base64.txt
```

**Security Note:** Keep the base64-encoded files secure and delete them after adding to GitHub Secrets.

---

### Migration Path: Local → AKS

When you're ready to move from local testing to Azure AKS:

#### Step 1: Validate Everything Works Locally

```bash
# Ensure all workflows pass on local cluster
# - CI Pipeline ✅
# - Deploy Staging ✅
# - Deploy Production ✅
# - All pods healthy ✅
```

#### Step 2: Setup AKS Cluster

```bash
# Create AKS cluster
az aks create \
  --resource-group realworld-rg \
  --name realworld-cluster \
  --node-count 3 \
  --enable-managed-identity \
  --generate-ssh-keys

# Get credentials
az aks get-credentials --resource-group realworld-rg --name realworld-cluster

# Verify connection
kubectl cluster-info
```

#### Step 3: Create AKS Namespaces

```bash
# Same commands as local, but now pointing to AKS
kubectl create namespace realworld-staging
kubectl create namespace realworld-production
```

#### Step 4: Generate New KUBECONFIG for AKS

```bash
# Generate AKS kubeconfig (see Option B above)
kubectl config view --flatten > /tmp/kubeconfig-aks-staging.yaml
cat /tmp/kubeconfig-aks-staging.yaml | base64 -w 0 > /tmp/kubeconfig-aks-staging-base64.txt

# Repeat for production
```

#### Step 5: Update GitHub Secrets

**Replace local kubeconfig with AKS kubeconfig:**
1. Go to **Settings → Secrets → Actions**
2. Click on `KUBECONFIG_STAGING` → **Update**
3. Paste new AKS base64-encoded kubeconfig
4. Repeat for `KUBECONFIG_PRODUCTION`

#### Step 6: Update Workflows (If Using Self-Hosted Runner)

```yaml
# Change back to GitHub-hosted runners
runs-on: ubuntu-latest  # Changed from: self-hosted
```

#### Step 7: Test AKS Deployment

```bash
# Trigger a deployment to staging
git push origin develop

# Watch deployment
kubectl get pods -n realworld-staging -w
```

#### Step 8: Verify and Cleanup Local

```bash
# Once AKS works, cleanup local resources
helm uninstall realworld -n realworld-staging
helm uninstall realworld -n realworld-production
kubectl delete namespace realworld-staging
kubectl delete namespace realworld-production
```

### Comparison: Local vs AKS

| Aspect | Local (Docker Desktop) | Azure AKS |
|--------|------------------------|-----------|
| **Setup Time** | 5 minutes | 15-30 minutes |
| **Cost** | Free | ~$150-300/month |
| **Access from GitHub** | Self-hosted runner or ngrok | Direct (public endpoint) |
| **Performance** | Limited by laptop | Production-grade |
| **Persistence** | Lost on restart | Persistent storage |
| **Networking** | Localhost only | Public IP/Load Balancer |
| **SSL/TLS** | Manual cert | Azure cert management |
| **High Availability** | Single node | Multi-node with autoscaling |
| **Best For** | Development/Testing | Staging/Production |

### Recommended Workflow

1. **Week 1:** Setup local cluster, validate CI/CD works end-to-end
2. **Week 2:** Test all workflows, PRs, deployments locally
3. **Week 3:** Setup AKS cluster, migrate secrets
4. **Week 4:** Run both environments in parallel, compare
5. **Week 5+:** Switch to AKS for staging/production, keep local for development

---

## GitHub Secrets Configuration

### 1. Add Repository Secrets

Go to **Settings → Secrets and variables → Actions → Repository secrets**

Add the following secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `KUBECONFIG_STAGING` | (base64-encoded kubeconfig) | Staging namespace access |
| `KUBECONFIG_PRODUCTION` | (base64-encoded kubeconfig) | Production namespace access |

**Steps to add a secret:**
1. Click **New repository secret**
2. Name: `KUBECONFIG_STAGING`
3. Value: Paste the contents of `/tmp/kubeconfig-staging-base64.txt`
4. Click **Add secret**
5. Repeat for `KUBECONFIG_PRODUCTION`

### 2. Verify Secrets

After adding secrets, you should see:
- ✅ `KUBECONFIG_STAGING`
- ✅ `KUBECONFIG_PRODUCTION`
- ✅ `GITHUB_TOKEN` (auto-provided, no action needed)

---

## GitHub Environments Setup

### 1. Create Staging Environment

1. Go to **Settings → Environments**
2. Click **New environment**
3. Name: `staging`
4. Click **Configure environment**

**Configuration:**
- **Environment protection rules**: None (auto-deploy)
- **Environment secrets**: None needed (uses repository secrets)
- **Deployment branches**: All branches

**Environment variables (optional):**
| Name | Value |
|------|-------|
| `NAMESPACE` | `realworld-staging` |

5. Click **Save protection rules**

### 2. Create Production Environment

1. Go to **Settings → Environments**
2. Click **New environment**
3. Name: `production`
4. Click **Configure environment**

**Configuration:**
- **Environment protection rules**:
  - ✅ **Required reviewers**: Add `@jjuuniper` (or your GitHub username)
  - ✅ **Wait timer**: 0 minutes (optional: add delay for review window)
- **Deployment branches**: Selected branches → `main` only

**Environment variables (optional):**
| Name | Value |
|------|-------|
| `NAMESPACE` | `realworld-production` |

5. Click **Save protection rules**

---

## Branch Protection Rules

### 1. Protect `develop` Branch

1. Go to **Settings → Branches → Add branch protection rule**
2. Branch name pattern: `develop`

**Settings:**
- ✅ **Require a pull request before merging**
  - ✅ Require approvals: 1
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - **Status checks required:**
    - `Lint Backend`
    - `Lint Frontend`
    - `Test Backend`
    - `TypeScript Type Check`
    - `Security - Secret Scanning`
    - `Security - Dependency Scanning`
    - `Security - SAST (Semgrep)`
    - `Scan Backend Image`
    - `Scan Frontend Image`
- ✅ **Require conversation resolution before merging**
- ✅ **Do not allow bypassing the above settings**

3. Click **Create**

### 2. Protect `main` Branch

1. Go to **Settings → Branches → Add branch protection rule**
2. Branch name pattern: `main`

**Settings:**
- ✅ **Require a pull request before merging**
  - ✅ Require approvals: 1
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - **Status checks required:** (same as develop)
- ✅ **Require conversation resolution before merging**
- ✅ **Restrict pushes that create matching branches**
- ✅ **Do not allow bypassing the above settings**

3. Click **Create**

---

## Code Owners Configuration

### What is CODEOWNERS?

The `.github/CODEOWNERS` file automatically assigns reviewers to pull requests based on which files are changed. This is essential for Dependabot PRs since GitHub deprecated the `reviewers` field in `dependabot.yml`.

### Current Configuration

The repository already includes a [`.github/CODEOWNERS`](.github/CODEOWNERS) file that automatically assigns **@jjuuniper** as reviewer for:

- **Dependency updates** - `package.json`, `package-lock.json` files
- **Docker updates** - `Dockerfile` changes
- **GitHub Actions** - Workflow file changes
- **CI/CD configuration** - `dependabot.yml`, CI/CD documentation

### How It Works

**When Dependabot creates a PR:**
1. Dependabot updates `backend/package.json`
2. CODEOWNERS file matches the pattern: `backend/package.json @jjuuniper`
3. GitHub automatically requests review from @jjuuniper
4. You receive a notification to review the PR

**For manual PRs:**
- CODEOWNERS applies to all PRs (not just Dependabot)
- Ensures appropriate reviewers are assigned based on changed files
- Works for team members and external contributors

### Modifying CODEOWNERS

**To add additional reviewers:**
```
# Add multiple reviewers
backend/package.json @jjuuniper @another-user

# Add a team (for organizations)
backend/package.json @your-org/backend-team
```

**To require specific reviewers for certain paths:**
```
# Security-critical files require security team review
.github/workflows/ @your-org/security-team
backend/middleware/auth.js @your-org/security-team
```

**Important Notes:**
- CODEOWNERS requires reviewers to have repository access
- For personal repos, only collaborators can be assigned
- For organization repos, teams can be used with `@org/team-name` syntax
- The first matching pattern wins (more specific patterns should come first)

### Why We Use CODEOWNERS Instead of dependabot.yml reviewers

**GitHub deprecated `dependabot.yml` reviewers field:**
- **Deprecated:** April 2025
- **Removed:** August 2025
- **Reason:** Duplicate functionality with CODEOWNERS

**Benefits of CODEOWNERS:**
- ✅ Works for all PRs (not just Dependabot)
- ✅ Centralized reviewer assignment logic
- ✅ Supports teams in organizations
- ✅ More flexible pattern matching
- ✅ No maintenance overhead for deprecated features

**Migration from old approach:**
If you see this in old documentation:
```yaml
# ❌ DEPRECATED - No longer works
reviewers:
  - "jjuuniper"
```

It has been replaced with:
```
# ✅ Current approach - Works for all PRs
backend/package.json @jjuuniper
```

---

## Testing the CI/CD Pipeline

### 1. Create a Test Feature Branch

```bash
# Create and checkout feature branch
git checkout develop
git pull origin develop
git checkout -b feature/test-cicd

# Make a small change
echo "# CI/CD Test" >> TEST.md
git add TEST.md
git commit -m "feat: Add CI/CD test file"
git push origin feature/test-cicd
```

### 2. Create a Pull Request

1. Go to GitHub → **Pull requests → New pull request**
2. Base: `develop` ← Compare: `feature/test-cicd`
3. Title: `feat: Add CI/CD test file` (must follow conventional commits)
4. Click **Create pull request**

**Expected Behavior:**
- ✅ PR Checks workflow runs (title validation, size check, checklist)
- ✅ CI Pipeline workflow runs (all stages)
- ✅ Images are built locally but **not pushed** (PR only)
- ✅ All security scans run
- ✅ Coverage report posted as comment

### 3. Merge to Develop

1. Wait for all checks to pass
2. Get approval (if required)
3. Click **Merge pull request**

**Expected Behavior:**
- ✅ CI Pipeline runs again on `develop` branch
- ✅ Images are **pushed** to GitHub Container Registry with `develop` tags
- ✅ Deploy Staging workflow triggers automatically
- ✅ Application deploys to `realworld-staging` namespace

### 4. Verify Staging Deployment

```bash
# Check staging pods
kubectl get pods -n realworld-staging

# Check staging deployment
kubectl get deployments -n realworld-staging

# Check staging services
kubectl get services -n realworld-staging

# Test backend health
kubectl port-forward -n realworld-staging svc/backend 4000:4000
# In another terminal:
curl http://localhost:4000/api/health
```

### 5. Merge to Main (Release)

```bash
# Create PR from develop to main
git checkout main
git pull origin main

# Create PR via GitHub UI: develop → main
```

**Expected Behavior:**
- ✅ CI Pipeline runs on `main` branch
- ✅ Images pushed with version tags (`1.0.0`, `latest`, etc.)
- ✅ Release workflow creates GitHub Release
- ✅ CHANGELOG.md updated
- ✅ Semantic version automatically determined from commits

### 6. Deploy to Production (Manual)

1. Go to **Actions → Deploy to Production**
2. Click **Run workflow**
3. Branch: `main`
4. Version: `1.0.0` (or the version from the release)
5. Click **Run workflow**
6. **Approval required**: A reviewer must approve the deployment

**Expected Behavior:**
- ⏳ Workflow waits for approval
- ✅ After approval, deploys to `realworld-production` namespace
- ✅ Health checks run
- ✅ Rollback on failure

---

## Workflow Reference

### CI Pipeline (`ci.yml`)

**Triggers:**
- Pull requests to `develop` or `main`
- Pushes to `develop` or `main`
- Ignores changes to: `**.md`, `docs/**`, `.gitignore`

**Jobs:**
1. Lint backend (ESLint)
2. Lint frontend (ESLint + Prettier)
3. Test backend (Jest, 80% coverage threshold)
4. TypeScript type checking
5. Secret scanning (TruffleHog)
6. Dependency scanning (npm audit)
7. SAST (Semgrep)
8. Build backend image (local)
9. Build frontend image (local)
10. Scan backend image (Trivy, **security gate**)
11. Scan frontend image (Trivy, **security gate**)
12. Push images (only on `develop`/`main` if scans pass)

**Artifacts:**
- Backend coverage report (7 days)
- Frontend coverage report (7 days)
- SBOMs (90 days)
- Trivy SARIF results (uploaded to GitHub Security)

### Deploy Staging (`deploy-staging.yml`)

**Triggers:**
- After successful CI Pipeline run on `develop` branch

**Environment:** `staging`

**Steps:**
1. Configure kubectl with `KUBECONFIG_STAGING`
2. Deploy using Helm with `values-staging.yaml`
3. Wait for pods to be ready (5 minute timeout)
4. Run basic health checks
5. Post deployment summary

### Deploy Production (`deploy-production.yml`)

**Triggers:**
- Manual workflow dispatch only

**Environment:** `production` (requires approval from `@jjuuniper`)

**Inputs:**
- `version`: Version to deploy (e.g., `1.0.0`)

**Steps:**
1. Validate version exists in registry
2. Create backup of current deployment
3. Deploy using Helm with `values-prod.yaml`
4. Wait for pods to be ready (10 minute timeout)
5. Run smoke tests
6. Monitor for 2 minutes
7. Rollback automatically on failure

### PR Checks (`pr-checks.yml`)

**Triggers:**
- Pull request opened, edited, synchronized, reopened

**Jobs:**
1. **PR title check**: Validates conventional commit format
2. **PR size check**: Warns if >500 lines changed
3. **Coverage comment**: Posts test coverage as PR comment
4. **Security summary**: Posts security scan info
5. **PR checklist**: Posts checklist on PR open

### Release (`release.yml`)

**Triggers:**
- Push to `main` branch

**Features:**
- Uses `semantic-release` for automated versioning
- Generates `CHANGELOG.md`
- Creates GitHub Release with notes
- Updates `package.json` versions
- Follows conventional commits specification

**Version Bump Rules:**
- `feat: ...` → Minor version (0.1.0 → 0.2.0)
- `fix: ...` → Patch version (0.1.0 → 0.1.1)
- `BREAKING CHANGE:` → Major version (0.1.0 → 1.0.0)
- `chore: ...` → No release

---

## Troubleshooting

### Issue: CI Pipeline Fails on Trivy Scan

**Symptom:** "Scan Backend Image" or "Scan Frontend Image" job fails

**Cause:** Critical or high severity vulnerabilities found in Docker image

**Solution:**
1. Check Trivy results in GitHub Security tab
2. Update base Docker images in `backend/Dockerfile` or `frontend/Dockerfile`
3. Update vulnerable npm dependencies:
   ```bash
   cd backend
   npm audit fix
   npm audit fix --force  # If needed
   ```
4. Re-run CI pipeline

### Issue: Staging Deployment Fails

**Symptom:** "Deploy to Staging" workflow fails

**Causes & Solutions:**

**1. KUBECONFIG issue:**
```bash
# Verify secret is correct
echo $KUBECONFIG_STAGING | base64 -d | kubectl --kubeconfig=- get nodes
```

**2. Namespace doesn't exist:**
```bash
kubectl create namespace realworld-staging
```

**3. Helm chart errors:**
```bash
# Validate Helm chart locally
helm lint ./infrastructure/helm/realworld
helm template realworld ./infrastructure/helm/realworld \
  -f ./infrastructure/helm/realworld/values-staging.yaml
```

**4. Pod failures:**
```bash
# Check pod logs
kubectl logs -n realworld-staging -l app.kubernetes.io/name=backend --tail=100

# Check pod events
kubectl describe pod -n realworld-staging <pod-name>
```

### Issue: Production Deployment Requires Approval But No Notification

**Symptom:** Workflow stuck waiting for approval

**Solution:**
1. Go to **Actions → Deploy to Production → [Running workflow]**
2. You'll see a yellow banner: "Review pending"
3. Click **Review deployments**
4. Select `production` environment
5. Click **Approve and deploy**

**Auto-notification setup (optional):**
- GitHub doesn't send email notifications for deployment approvals by default
- Set up GitHub mobile app for push notifications
- Use Slack/Discord webhooks for custom notifications

### Issue: npm audit Fails on Known Non-Critical Vulnerabilities

**Symptom:** "Security - Dependency Scanning" fails on moderate vulnerabilities

**Solution:**

**Option 1: Fix vulnerabilities**
```bash
cd backend  # or frontend
npm audit fix
```

**Option 2: Adjust audit level (not recommended for production)**
Edit `.github/workflows/ci.yml`:
```yaml
- name: Run npm audit
  working-directory: ${{ matrix.component }}
  run: npm audit --audit-level=critical  # Changed from 'high'
```

### Issue: Test Coverage Below 80%

**Symptom:** "Test Backend" job fails with coverage error

**Solution:**
1. Add more unit tests to increase coverage
2. Check coverage report:
   ```bash
   cd backend
   npm run test:coverage
   open coverage/lcov-report/index.html
   ```
3. Focus on untested files/functions

**Temporary bypass (not recommended):**
Edit `.github/workflows/ci.yml` to lower threshold (update both locations):
```yaml
if (( $(echo "$COVERAGE < 70" | bc -l) )); then  # Changed from 80
```

### Issue: Docker Build Fails on GitHub Actions But Works Locally

**Symptom:** "Build Backend Image" or "Build Frontend Image" fails

**Causes & Solutions:**

**1. Platform architecture mismatch:**
```yaml
# Add to docker/build-push-action
platforms: linux/amd64
```

**2. Missing build arguments:**
```bash
# Test build locally with same command as CI
docker build --no-cache -t test ./backend
```

**3. Network issues during npm install:**
```dockerfile
# Add to Dockerfile
RUN npm ci --legacy-peer-deps --prefer-offline
```

### Issue: Semantic Release Doesn't Create a Release

**Symptom:** "Create Release" workflow completes but no release appears

**Causes & Solutions:**

**1. No releasable commits:**
- Semantic-release only creates releases for `feat:`, `fix:`, etc.
- Check commits follow conventional commits format
- `chore:` commits don't trigger releases

**2. Version already exists:**
```bash
# Check latest release
git tag -l
```

**3. Debug semantic-release:**
```bash
# Run locally
npm install -g semantic-release @semantic-release/changelog @semantic-release/github
GITHUB_TOKEN=<your-token> npx semantic-release --dry-run
```

### Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `exit-code: '1'` in Trivy | Vulnerabilities found | Update dependencies or base images |
| `KUBECONFIG: not found` | Secret not configured | Add `KUBECONFIG_STAGING` or `KUBECONFIG_PRODUCTION` secret |
| `ImagePullBackOff` | Cannot pull image from registry | Check image exists and registry permissions |
| `CrashLoopBackOff` | Pod keeps crashing | Check pod logs: `kubectl logs <pod> -n <namespace>` |
| `PR title doesn't match` | Wrong commit format | Use `feat:`, `fix:`, `docs:`, etc. |
| `Coverage 75% below 80%` | Insufficient tests | Add more unit tests |

---

## Additional Resources

- **Conventional Commits:** https://www.conventionalcommits.org/
- **Semantic Versioning:** https://semver.org/
- **GitHub Actions:** https://docs.github.com/en/actions
- **Helm Documentation:** https://helm.sh/docs/
- **Trivy Scanner:** https://github.com/aquasecurity/trivy
- **Semgrep Rules:** https://semgrep.dev/explore

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section above
2. Review workflow logs in GitHub Actions tab
3. Check `CICD_SPECIFICATION.md` for architectural decisions
4. Consult `CLAUDE.md` for project-specific guidelines

---

**Last Updated:** 2025-10-30
**Version:** 1.0.0
