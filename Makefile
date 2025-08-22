# ft_transcendence Makefile
# Manages Docker Compose setup with HTTPS support (fully containerized)

.PHONY: all help build up down restart logs clean fclean re ssl-localhost ssl-letsencrypt ssl-auto status dev test-ssl backup-certs renew-letsencrypt shell-pong shell-nginx logs-pong logs-nginx

# Default target - builds and starts everything
all: build up

# Help target
help:
	@echo "🚀 ft_transcendence - Available commands:"
	@echo ""
	@echo "Main targets:"
	@echo "  make / make all     Build and start all services"
	@echo "  make build          Build all Docker images"
	@echo "  make up             Start all services"
	@echo "  make down           Stop all services"
	@echo "  make restart        Restart all services"
	@echo "  make re             Rebuild and restart everything"
	@echo "  make clean          Stop and remove containers/networks"
	@echo "  make fclean         Complete cleanup (images, volumes, everything)"
	@echo ""
	@echo "SSL/HTTPS:"
	@echo "  make ssl-localhost  Generate self-signed certificates for localhost"
	@echo "  make ssl-letsencrypt Setup Let's Encrypt for trans.smasse.xyz (server only)"
	@echo "  make ssl-auto       Auto-detect environment and setup appropriate SSL"
	@echo ""
	@echo "Monitoring:"
	@echo "  make logs           Show logs for all services"
	@echo "  make logs-pong      Show logs for pong game only"
	@echo "  make logs-nginx     Show logs for nginx only"
	@echo "  make status         Show status of all services"
	@echo ""
	@echo "Development:"
	@echo "  make dev            Start in development mode with live reload and Tailwind CSS auto-rebuild"
	@echo "  make dev-local      Start local development without Docker (requires Node.js)"
	@echo "  make shell-pong     Open shell in pong game container"
	@echo "  make shell-nginx    Open shell in nginx container"
	@echo "  make test-ssl       Test SSL certificates and endpoints"
	@echo ""
	@echo "URLs after setup:"
	@echo "  - https://localhost:8443 (self-signed)"
	@echo "  - http://localhost:8080 (redirects to HTTPS)"
	@echo "  - https://trans.smasse.xyz (Let's Encrypt)"

build:
	@echo "🔨 Building Docker images..."
	docker-compose build

# Start all services (SSL certs generated automatically via init container)
up:
	@echo "🚀 Starting ft_transcendence..."
	docker-compose up -d
	@if [ -f ./nginx/conf.d/.server-mode ] && grep -q "SERVER_MODE=true" ./nginx/conf.d/.server-mode; then \
		echo "🌐 Server mode detected! Available at:"; \
		echo "   - https://localhost:8443 (self-signed)"; \
		echo "   - http://localhost:8080 (redirects to HTTPS)"; \
		echo "   - https://trans.smasse.xyz (after Let's Encrypt setup)"; \
		echo ""; \
		echo "💡 Run 'make ssl-letsencrypt' to set up Let's Encrypt for trans.smasse.xyz"; \
	else \
		echo "� Local mode detected! Available at:"; \
		echo "   - https://localhost:8443 (self-signed)"; \
		echo "   - http://localhost:8080 (redirects to HTTPS)"; \
	fi
	@echo "✅ Services started!"

# Stop all services
down:
	@echo "🛑 Stopping ft_transcendence..."
	docker-compose down

# Restart all services
restart:
	@echo "🔄 Restarting ft_transcendence..."
	docker-compose restart
	@echo "✅ Services restarted!"

# Rebuild and restart everything
re: fclean all

# Development mode with live reload
dev:
	@echo "🛠️  Starting in development mode with Tailwind CSS auto-rebuild..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Local development (no Docker)
dev-local:
	@echo "🛠️  Starting local development mode..."
	@echo "💡 Make sure you have Node.js and npm installed"
	@cd node && npm install && npm run dev:full

# Generate self-signed certificates using containerized approach
ssl-localhost:
	@echo "🔐 Generating self-signed SSL certificates (containerized)..."
	docker-compose run --rm ssl-generator
	@echo "✅ Self-signed certificates generated!"

# Setup Let's Encrypt certificates (containerized)
ssl-letsencrypt:
	@if [ -f ./nginx/conf.d/.server-mode ] && grep -q "SERVER_MODE=true" ./nginx/conf.d/.server-mode; then \
		echo "🔐 Setting up Let's Encrypt for trans.smasse.xyz..."; \
		echo "⚠️  Make sure DNS is pointing to this server!"; \
		read -p "Enter your email for Let's Encrypt: " email; \
		echo "Starting nginx for ACME challenge..."; \
		docker-compose up -d nginx; \
		sleep 5; \
		echo "Requesting certificate..."; \
		LETSENCRYPT_EMAIL=$$email docker-compose --profile setup run --rm letsencrypt-setup; \
		if [ $$? -eq 0 ]; then \
			echo "✅ Let's Encrypt certificate obtained!"; \
			docker-compose restart nginx; \
			echo "🌐 Now available at https://trans.smasse.xyz"; \
		else \
			echo "❌ Failed to obtain certificate. Check DNS and connectivity."; \
		fi; \
	else \
		echo "❌ Not running on server IP (188.245.229.241)"; \
		echo "💡 Let's Encrypt is only available when running on the production server"; \
	fi

# Auto-setup: detects environment and sets up appropriate SSL
ssl-auto:
	@echo "🔍 Auto-detecting environment and setting up SSL..."
	@make up
	@if [ -f ./nginx/conf.d/.server-mode ] && grep -q "SERVER_MODE=true" ./nginx/conf.d/.server-mode; then \
		echo "🌐 Server environment detected!"; \
		echo "🔐 Would you like to set up Let's Encrypt? (y/N)"; \
		read -p "Continue with Let's Encrypt setup? " -n 1 -r; \
		echo; \
		if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
			make ssl-letsencrypt; \
		fi; \
	else \
		echo "🏠 Local environment detected - using self-signed certificates only"; \
	fi

# Show logs for all services
logs:
	docker-compose logs -f

# Show logs for pong game only
logs-pong:
	docker-compose logs -f pong-game

# Show logs for nginx only
logs-nginx:
	docker-compose logs -f nginx

# Show status of all services
status:
	@echo "📊 Service Status:"
	@docker-compose ps
	@echo ""
	@echo "🔍 Container Details:"
	@docker ps --filter "name=ft_transcendence" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Open shell in pong game container
shell-pong:
	docker-compose exec pong-game sh

# Open shell in nginx container
shell-nginx:
	docker-compose exec nginx sh

# Clean up containers and networks (keeps images and volumes)
clean:
	@echo "🧹 Cleaning up containers and networks..."
	docker-compose down --remove-orphans
	@echo "✅ Containers and networks cleaned!"

# Complete cleanup - removes everything including images and volumes
fclean:
	@echo "🗑️  Complete cleanup - removing everything..."
	@echo "Stopping and removing all containers..."
	docker-compose down -v --remove-orphans --rmi all 2>/dev/null || true
	@echo "Removing ft_transcendence images..."
	docker images | grep ft_transcendence | awk '{print $$3}' | xargs -r docker rmi -f 2>/dev/null || true
	@echo "Removing unused Docker resources..."
	docker system prune -af --volumes 2>/dev/null || true
	@echo "Removing generated SSL certificates..."
	rm -rf ./nginx/ssl/*.crt ./nginx/ssl/*.key 2>/dev/null || true
	@echo "Removing server mode detection file..."
	rm -f ./nginx/conf.d/.server-mode 2>/dev/null || true
	@echo "Removing backup files..."
	rm -rf ./backups 2>/dev/null || true
	@echo "Removing node_modules..."
	rm -rf ./node/node_modules 2>/dev/null || true
	@echo "Removing generated css files..."
	rm -rf ./node/public/css/output.css 2>/dev/null || true
	@echo "✅ Complete cleanup finished!"

# Test SSL certificates (containerized)
test-ssl:
	@echo "🔍 Testing SSL certificates..."
	@docker-compose run --rm ssl-generator sh -c \
		"if [ -f /ssl/localhost.crt ]; then \
			echo '📄 Localhost certificate info:'; \
			openssl x509 -in /ssl/localhost.crt -text -noout | grep -E '(Subject:|Not After)'; \
		else \
			echo '❌ No localhost certificate found'; \
		fi"
	@echo ""
	@echo "🌐 Testing HTTPS endpoints:"
	@echo "Testing https://localhost:8443..."
	@curl -k -s -o /dev/null -w "Status: %{http_code}\n" https://localhost:8443 || echo "❌ localhost:8443 not reachable"
	@echo "Testing http://localhost:8080..."
	@curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080 || echo "❌ localhost:8080 not reachable"

# Backup certificates
backup-certs:
	@echo "💾 Backing up certificates..."
	@mkdir -p ./backups
	@docker run --rm -v $(PWD)/nginx/ssl:/ssl -v $(PWD)/backups:/backups alpine:latest \
		sh -c "tar -czf /backups/certs-$(shell date +%Y%m%d-%H%M%S).tar.gz -C /ssl ."
	@echo "✅ Certificates backed up to ./backups/"

# Renew Let's Encrypt certificates (containerized)
renew-letsencrypt:
	@echo "🔄 Renewing Let's Encrypt certificates..."
	docker-compose run --rm certbot renew
	docker-compose restart nginx
	@echo "✅ Certificate renewal complete!"