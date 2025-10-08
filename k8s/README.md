# Kubernetes Deployment for RealWorld Application

This directory contains Kubernetes manifests for deploying the RealWorld application with MongoDB, Express.js backend, and Next.js frontend.

## Quick Start

### Prerequisites
- Kubernetes cluster (local or cloud)
- kubectl configured
- Docker images built locally or available in registry

### Build Images (if needed)
```bash
# Build backend image
docker build -t realworld-backend:latest ./backend

# Build frontend image
docker build -t realworld-frontend:latest ./frontend
```

### Deploy with Raw Manifests
```bash
# Deploy all components
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/mongodb/
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/network-policy.yaml

# Check deployment status
kubectl get all -n realworld

# Access the application
kubectl port-forward -n realworld svc/frontend 3000:3000
# Visit http://localhost:3000
```

### Deploy with Helm
```bash
# Install with default values
helm install realworld ./helm/realworld

# Install for development
helm install realworld-dev ./helm/realworld -f ./helm/realworld/values-dev.yaml

# Install for production
helm install realworld-prod ./helm/realworld -f ./helm/realworld/values-prod.yaml
```

## Architecture

### Services
- **MongoDB StatefulSet**: Persistent database with 5Gi storage
- **Backend Deployment**: 2 replicas of Express.js API
- **Frontend Deployment**: 2 replicas of Next.js application
- **Ingress**: Routes traffic to appropriate services

### Security Features
- Non-root containers with security contexts
- RBAC for service accounts
- Network policies for micro-segmentation
- Secrets for sensitive configuration

### Configuration
- **ConfigMaps**: Non-sensitive environment variables
- **Secrets**: Database credentials and JWT secrets (base64 encoded)
- **Resource Limits**: Memory and CPU constraints for all pods

## Validation

### Check Pod Status
```bash
kubectl get pods -n realworld -w
```

### View Logs
```bash
kubectl logs -n realworld -l app=backend
kubectl logs -n realworld -l app=frontend
kubectl logs -n realworld -l app=mongodb
```

### Test Connectivity
```bash
# Test backend API
kubectl port-forward -n realworld svc/backend 4000:4000
curl http://localhost:4000/api/tags

# Test frontend
kubectl port-forward -n realworld svc/frontend 3000:3000
```

## Cleanup
```bash
# Remove all resources
kubectl delete namespace realworld

# Or with Helm
helm uninstall realworld
```

## Production Considerations

1. **Image Registry**: Push images to container registry for multi-node clusters
2. **Storage Class**: Configure appropriate StorageClass for persistent volumes
3. **Domain**: Replace `realworld.local` with actual domain in ingress
4. **Secrets**: Rotate default passwords and JWT secrets
5. **Resources**: Adjust resource limits based on actual usage
6. **Monitoring**: Add Prometheus ServiceMonitors for metrics collection