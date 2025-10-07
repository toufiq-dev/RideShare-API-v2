#!/bin/bash
# enhanced-deploy.sh

set -e

# Configuration
ENVIRONMENT=${1:-production}
SERVICE=${2:-all}
BACKUP_DIR="/home/azureuser/fairdrive-api/backups/$(date +%Y%m%d_%H%M%S)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Create backup
create_backup() {
  log "Creating backup..."
  mkdir -p "$BACKUP_DIR"
  
  # Backup container status
  docker-compose ps > "$BACKUP_DIR/containers-status.txt"
  
  # Backup environment files
  cp .env* "$BACKUP_DIR/" 2>/dev/null || true
  cp docker-compose.yml "$BACKUP_DIR/"
  
  log "Backup created at $BACKUP_DIR"
}

# Health check with retries
health_check() {
  local service=$1
  local port=$2
  local max_attempts=10
  local attempt=1
  
  while [ $attempt -le $max_attempts ]; do
    if curl -f -s "http://localhost:$port/health" > /dev/null; then
      log "✅ $service is healthy"
      return 0
    else
      warn "⏳ $service health check attempt $attempt/$max_attempts"
      sleep 5
      ((attempt++))
    fi
  done
  
  error "❌ $service health check failed after $max_attempts attempts"
  return 1
}

# Zero-downtime deployment
zero_downtime_deploy() {
  local service=$1
  local port=$2
  
  log "Deploying $service with zero downtime..."
  
  # Start new container
  docker-compose up -d --no-deps --build "$service"
  
  # Wait for new container to be healthy
  health_check "$service" "$port"
  
  # Stop old container
  docker-compose stop "$service"
  docker-compose rm -f "$service"
  
  log "✅ $service deployed successfully"
}

# Main deployment logic
case "$SERVICE" in
  "india")
    create_backup
    zero_downtime_deploy "fairdrive-api-india" "3000"
    ;;
  "v1")
    create_backup
    zero_downtime_deploy "fairdrive-api-v1" "3001"
    ;;
  "v2")
    create_backup
    zero_downtime_deploy "fairdrive-api-v2" "3002"
    ;;
  "dev")
    create_backup
    zero_downtime_deploy "fairdrive-api-dev" "8080"
    ;;
  "all")
    create_backup
    docker-compose down
    docker-compose up -d --build
    
    # Health checks for all services
    health_check "India API" "3000"
    health_check "V1 API" "3001"
    health_check "V2 API" "3002"
    health_check "Dev API" "8080"
    health_check "Redis" "6379"
    ;;
  *)
    error "Unknown service: $SERVICE"
    echo "Usage: $0 {production|staging} {india|v1|v2|dev|all}"
    exit 1
    ;;
esac

log "🎉 Deployment completed successfully!"