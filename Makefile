.PHONY: help up down restart logs build build-prod clean size

help:
	@echo "Available commands:"
	@echo "  make up         - Start the app with docker-compose (development)"
	@echo "  make down       - Stop the app"
	@echo "  make restart    - Restart the app"
	@echo "  make logs       - View app logs"
	@echo "  make build      - Build the docker image (development)"
	@echo "  make build-prod - Build optimized production image"
	@echo "  make size       - Show docker image sizes"
	@echo "  make clean      - Remove containers and volumes"

up:
	docker-compose up -d

down:
	docker-compose down

restart: down up

logs:
	docker-compose logs -f

build:
	docker-compose build

build-prod:
	docker build -f Dockerfile.prod -t learning-master-ai:prod .

size:
	@echo "Development image size:"
	@docker images learning-master-ai:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" || echo "Dev image not built"
	@echo "\nProduction image size:"
	@docker images learning-master-ai:prod --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" || echo "Prod image not built"

clean:
	docker-compose down -v
	@docker rmi -f learning-master-ai:latest learning-master-ai:prod 2>/dev/null || true
