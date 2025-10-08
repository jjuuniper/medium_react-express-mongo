# Phase 1: Kubernetes Foundation - Implementation Guide

This document provides complete implementation context for Phase 1 of the Enterprise DevOps features, focusing on Kubernetes Foundation.

## Current Architecture Context

### Existing Docker Configuration
- **Backend**: Express.js API on port 4000 (`backend/` directory)
- **Frontend**: Next.js 15 on port 3000 (`frontend/` directory)
- **Database**: MongoDB on port 27017
- **Container Images**: Multi-stage Dockerfiles with production and development targets
- **Networking**: Custom bridge network for container communication

### Environment Variables (from .env.example)
```env
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=password123
MONGO_DB_NAME=realworld
ACCESS_TOKEN_SECRET=your-super-secret-jwt-key-here-change-this-in-production
NODE_ENV=production
PORT=4000
```

### Docker Compose Services Context
```yaml
# Current service dependencies:
mongodb -> app -> frontend
# Ports: 27017 (internal), 4000 (exposed), 3000 (exposed)
# Networks: realworld-network (bridge)
# Volumes: mongodb_data, mongodb_config
```

## Phase 1 Implementation Steps

### Step 1.1: Basic Kubernetes Manifests

#### Directory Structure to Create
```
k8s/
├── namespace.yaml
├── mongodb/
│   ├── mongodb-statefulset.yaml
│   ├── mongodb-service.yaml
│   └── mongodb-pvc.yaml
├── backend/
│   ├── backend-deployment.yaml
│   └── backend-service.yaml
├── frontend/
│   ├── frontend-deployment.yaml
│   └── frontend-service.yaml
└── ingress.yaml
```

#### 1.1.1 Namespace Configuration
**File: `k8s/namespace.yaml`**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: realworld
  labels:
    name: realworld
    environment: development
```

#### 1.1.2 MongoDB StatefulSet
**File: `k8s/mongodb/mongodb-pvc.yaml`**
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
  namespace: realworld
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: standard  # Adjust based on cluster
```

**File: `k8s/mongodb/mongodb-statefulset.yaml`**
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
  namespace: realworld
  labels:
    app: mongodb
    component: database
spec:
  serviceName: mongodb
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
        component: database
    spec:
      containers:
      - name: mongodb
        image: mongo:6
        ports:
        - containerPort: 27017
          name: mongodb
        env:
        - name: MONGO_INITDB_ROOT_USERNAME
          value: "admin"  # TODO: Move to ConfigMap in Step 1.2
        - name: MONGO_INITDB_ROOT_PASSWORD
          value: "password123"  # TODO: Move to Secret in Step 1.2
        - name: MONGO_INITDB_DATABASE
          value: "realworld"
        volumeMounts:
        - name: mongodb-data
          mountPath: /data/db
        - name: mongodb-config
          mountPath: /data/configdb
        livenessProbe:
          exec:
            command:
            - bash
            - -c
            - "echo 'db.runCommand(\"ping\").ok' | mongosh localhost:27017/test --quiet"
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          exec:
            command:
            - bash
            - -c
            - "echo 'db.runCommand(\"ping\").ok' | mongosh localhost:27017/test --quiet"
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 5
          failureThreshold: 3
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: mongodb-data
        persistentVolumeClaim:
          claimName: mongodb-pvc
      - name: mongodb-config
        emptyDir: {}
```

**File: `k8s/mongodb/mongodb-service.yaml`**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongodb
  namespace: realworld
  labels:
    app: mongodb
    component: database
spec:
  ports:
  - port: 27017
    targetPort: 27017
    name: mongodb
  selector:
    app: mongodb
  clusterIP: None  # Headless service for StatefulSet
```

#### 1.1.3 Backend Deployment
**File: `k8s/backend/backend-deployment.yaml`**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: realworld
  labels:
    app: backend
    component: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
        component: api
    spec:
      containers:
      - name: backend
        image: realworld-backend:latest  # TODO: Replace with actual image
        ports:
        - containerPort: 4000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "4000"
        - name: DATABASE_URI
          value: "mongodb://admin:password123@mongodb:27017/realworld?authSource=admin"  # TODO: Move to ConfigMap/Secret in Step 1.2
        - name: ACCESS_TOKEN_SECRET
          value: "your-super-secret-jwt-key-here-change-this-in-production"  # TODO: Move to Secret in Step 1.2
        livenessProbe:
          httpGet:
            path: /
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /
            port: 4000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 5
          failureThreshold: 3
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
      initContainers:
      - name: wait-for-mongodb
        image: busybox:1.35
        command: ['sh', '-c', 'until nc -z mongodb 27017; do echo waiting for mongodb; sleep 2; done;']
```

**File: `k8s/backend/backend-service.yaml`**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: realworld
  labels:
    app: backend
    component: api
spec:
  ports:
  - port: 4000
    targetPort: 4000
    name: http
  selector:
    app: backend
  type: ClusterIP
```

#### 1.1.4 Frontend Deployment
**File: `k8s/frontend/frontend-deployment.yaml`**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: realworld
  labels:
    app: frontend
    component: ui
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
        component: ui
    spec:
      containers:
      - name: frontend
        image: realworld-frontend:latest  # TODO: Replace with actual image
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: API_BASE_URL
          value: "http://backend:4000/api"  # TODO: Move to ConfigMap in Step 1.2
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 5
          failureThreshold: 3
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
      initContainers:
      - name: wait-for-backend
        image: busybox:1.35
        command: ['sh', '-c', 'until nc -z backend 4000; do echo waiting for backend; sleep 2; done;']
```

**File: `k8s/frontend/frontend-service.yaml`**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: realworld
  labels:
    app: frontend
    component: ui
spec:
  ports:
  - port: 3000
    targetPort: 3000
    name: http
  selector:
    app: frontend
  type: ClusterIP
```

#### 1.1.5 Ingress Configuration
**File: `k8s/ingress.yaml`**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: realworld-ingress
  namespace: realworld
  labels:
    app: realworld
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/proxy-body-size: "1m"
spec:
  ingressClassName: nginx  # Adjust based on your cluster
  rules:
  - host: realworld.local  # TODO: Replace with actual domain or use IP
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 4000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 3000
```

### Step 1.2: Environment Configuration

#### ConfigMap for Application Settings
**File: `k8s/configmap.yaml`**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: realworld-config
  namespace: realworld
data:
  NODE_ENV: "production"
  PORT: "4000"
  MONGO_DB_NAME: "realworld"
  API_BASE_URL: "http://backend:4000/api"
  FRONTEND_URL: "http://frontend:3000"
```

#### Secret for Sensitive Data
**File: `k8s/secret.yaml`**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: realworld-secret
  namespace: realworld
type: Opaque
data:
  # Base64 encoded values - use: echo -n 'value' | base64
  MONGO_ROOT_USERNAME: YWRtaW4=  # admin
  MONGO_ROOT_PASSWORD: cGFzc3dvcmQxMjM=  # password123
  ACCESS_TOKEN_SECRET: eW91ci1zdXBlci1zZWNyZXQtand0LWtleS1oZXJlLWNoYW5nZS10aGlzLWluLXByb2R1Y3Rpb24=
```

### Step 1.3: Production Hardening

#### Security Context Example (to be added to deployments)
```yaml
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
      containers:
      - name: container-name
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
```

#### Network Policy Example
**File: `k8s/network-policy.yaml`**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: realworld-network-policy
  namespace: realworld
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
  - from:
    - podSelector: {}
  egress:
  - to:
    - podSelector: {}
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
```

### Step 1.4: Helm Charts

#### Helm Chart Structure
```
helm/
└── realworld/
    ├── Chart.yaml
    ├── values.yaml
    ├── values-dev.yaml
    ├── values-staging.yaml
    ├── values-prod.yaml
    └── templates/
        ├── namespace.yaml
        ├── configmap.yaml
        ├── secret.yaml
        ├── mongodb/
        ├── backend/
        ├── frontend/
        └── ingress.yaml
```

#### Chart.yaml
```yaml
apiVersion: v2
name: realworld
description: RealWorld application Helm chart
type: application
version: 0.1.0
appVersion: "1.0.0"
maintainers:
- name: Developer
  email: developer@example.com
```

#### values.yaml (Base configuration)
```yaml
global:
  namespace: realworld
  environment: production

mongodb:
  enabled: true
  image: mongo:6
  replicas: 1
  storage: 5Gi
  resources:
    requests:
      memory: 256Mi
      cpu: 250m
    limits:
      memory: 512Mi
      cpu: 500m

backend:
  enabled: true
  image: realworld-backend:latest
  replicas: 2
  resources:
    requests:
      memory: 128Mi
      cpu: 100m
    limits:
      memory: 256Mi
      cpu: 200m

frontend:
  enabled: true
  image: realworld-frontend:latest
  replicas: 2
  resources:
    requests:
      memory: 128Mi
      cpu: 100m
    limits:
      memory: 256Mi
      cpu: 200m

ingress:
  enabled: true
  className: nginx
  host: realworld.local
  annotations: {}

secrets:
  mongoUsername: admin
  mongoPassword: password123
  jwtSecret: your-super-secret-jwt-key-here-change-this-in-production
```

## Validation Steps

### Step 1.1 Validation
```bash
# Create k8s directory and manifests
mkdir k8s k8s/mongodb k8s/backend k8s/frontend

# Build Docker images locally (if needed)
docker build -t realworld-backend:latest ./backend
docker build -t realworld-frontend:latest ./frontend

# Deploy to Kubernetes
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/mongodb/
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress.yaml

# Verify deployment
kubectl get all -n realworld
kubectl get pvc -n realworld

# Test connectivity
kubectl port-forward -n realworld svc/frontend 3000:3000
# Access http://localhost:3000

# Cleanup
kubectl delete namespace realworld
```

### Image Building Context

#### Backend Image Build
```bash
cd backend
docker build -t realworld-backend:latest .
```

#### Frontend Image Build
```bash
cd frontend
docker build -t realworld-frontend:latest .
```

## Dependencies and Prerequisites

### Kubernetes Cluster Requirements
- Kubernetes 1.20+
- Ingress controller (nginx recommended)
- StorageClass for persistent volumes
- Container runtime with Docker image support

### Local Development Tools
- kubectl configured for your cluster
- Docker for building images
- Access to container registry (or use local images)

## Known Limitations for Step 1.1

1. **Hardcoded secrets**: Will be resolved in Step 1.2
2. **Local images**: Need registry push for multi-node clusters
3. **Basic resource limits**: Will be optimized in Step 1.3
4. **No security policies**: Will be added in Step 1.3
5. **Manual deployment**: Will be templated in Step 1.4

## Next Steps After Step 1.1

1. Implement ConfigMaps and Secrets (Step 1.2)
2. Add security contexts and policies (Step 1.3)
3. Create Helm charts for templating (Step 1.4)
4. Move to Phase 2: Monitoring Stack

This provides the complete context needed to implement Phase 1 of the Kubernetes foundation, with clear validation steps and upgrade paths for each subsequent step.