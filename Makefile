.PHONY: all install dev build test lint format verify

all: verify

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

format:
	pnpm format

verify:
	pnpm verify
