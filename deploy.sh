#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Function to deploy specific environment
deploy_environment() {
    local env=$1
    local service_name=$2
    
    print_status "Deploying $env environment..."
    
    # Build and start the specific service
    docker-compose up -d --build $service_name
    
    if [ $? -eq 0 ]; then
        print_status "$env deployment completed successfully!"
    else
        print_error "$env deployment failed!"
        exit 1
    fi
}

# Function to check service health
check_health() {
    local service_name=$1
    local port=$2
    local path=$3
    
    print_status "Checking health for $service_name..."
    
    # Wait for service to be ready
    sleep 10
    
    # Check health endpoint
    if curl -f -s "http://localhost:$port$path" > /dev/null; then
        print_status "$service_name is healthy!"
    else
        print_error "$service_name health check failed!"
        return 1
    fi
}

# Main deployment logic
case "$1" in
    "legacy")
        deploy_environment "legacy" "fairdrive-api-legacy"
        check_health "Legacy API" "3000" "/health"
        ;;
    "latest")
        deploy_environment "latest" "fairdrive-api-latest"
        check_health "Latest API" "3001" "/health"
        ;;
    "dev")
        deploy_environment "development" "fairdrive-api-dev"
        check_health "Development API" "8080" "/health"
        ;;
    "all")
        print_status "Deploying all environments..."
        docker-compose up -d --build
        
        if [ $? -eq 0 ]; then
            print_status "All services deployed successfully!"
            
            # Check health for all services
            check_health "Legacy API" "3000" "/health"
            check_health "Latest API" "3001" "/health"
            check_health "Development API" "8080" "/health"
        else
            print_error "Deployment failed!"
            exit 1
        fi
        ;;
    "restart")
        print_status "Restarting all services..."
        docker-compose restart
        print_status "All services restarted!"
        ;;
    "stop")
        print_status "Stopping all services..."
        docker-compose down
        print_status "All services stopped!"
        ;;
    "logs")
        docker-compose logs -f $2
        ;;
    "status")
        docker-compose ps
        ;;
    *)
        echo "Usage: $0 {legacy|latest|dev|all|restart|stop|logs|status}"
        echo ""
        echo "Commands:"
        echo "  legacy  - Deploy legacy API (v1) - api.fairdriveindia.com"
        echo "  latest  - Deploy latest API (v2) - api.fairdriveindia.com/v2"
        echo "  dev     - Deploy development API - api.fairdriveindia.com/dev"
        echo "  all     - Deploy all environments"
        echo "  restart - Restart all services"
        echo "  stop    - Stop all services"
        echo "  logs    - Show logs (e.g., $0 logs fairdrive-api-legacy)"
        echo "  status  - Show service status"
        exit 1
        ;;
esac

print_status "Deployment completed successfully!"