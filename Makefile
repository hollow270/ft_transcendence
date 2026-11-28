.PHONY: up down

up: .env
	docker compose up --build

.env:
	cp .env.example .env

down:
	docker compose down
