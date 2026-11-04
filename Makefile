IMAGE := naokihori/my-markdown-viewer
CONTAINER := my-markdown-viewer

# host sources are mounted read-only: checks report violations but never modify files
# (edit on the host only). The dev image only provides the tools (node_modules), so it
# is rebuilt when dependencies change, not when sources do; build-dev is a cache hit then.
CHECK_RUN := docker run \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --rm \
    --network none \
    -v "${PWD}/server/package.json":/app/package.json:ro \
    -v "${PWD}/server/.oxlintrc.json":/app/.oxlintrc.json:ro \
    -v "${PWD}/server/tsconfig.json":/app/tsconfig.json:ro \
    -v "${PWD}/server/src":/app/src:ro \
    -v "${PWD}/web":/app/web:ro \
    $(IMAGE):dev

.PHONY: help build run build-dev typecheck lint fmt-check check test exec

help:
	@echo "build     : build release image"
	@echo "build-dev : build dev image (tools for the targets below; built automatically)"
	@echo "check     : typecheck + lint + fmt-check"
	@echo "fmt-check : run oxfmt --check (report only)"
	@echo "lint      : run oxlint (report only)"
	@echo "run       : run release image at http://localhost:8080/"
	@echo "test      : run unit tests"
	@echo "typecheck : run tsc (no emit)"

build:
	docker build --progress=plain --target release -t $(IMAGE):latest .

build-dev:
	docker build --progress=plain --target dev -t $(IMAGE):dev .

check: typecheck lint fmt-check

fmt-check: build-dev
	$(CHECK_RUN) npm run --silent fmt:check

lint: build-dev
	$(CHECK_RUN) npm run --silent lint

run:
	docker run \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --rm \
    -p 127.0.0.1:8080:8080 \
    --name $(CONTAINER) \
    -v "${PWD}/sample-docs":/docs:ro \
    $(IMAGE):latest

test: build-dev
	$(CHECK_RUN) npm run --silent test

typecheck: build-dev
	$(CHECK_RUN) npm run --silent typecheck

exec: build-dev
	# for maintenance etc
	docker run \
    --cap-drop ALL \
    --security-opt \
    no-new-privileges \
    --rm \
    -it \
    --name $(CONTAINER) \
    $(IMAGE):dev \
    sh

