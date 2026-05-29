.PHONY: generate-types build test lint

generate-types:
	python3 hack/generate-types.py

build:
	yarn build

test:
	yarn test

lint:
	yarn lint
