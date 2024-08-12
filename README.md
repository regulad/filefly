# Filefly Monorepo

To develop with this monorepo, prepare the following tools.

## Dependencies

### Python

At least Python 3.11 is required.

```bash
brew install python@3.11
```

### Poetry

Poetry is used to manage Python dependencies.

```bash
brew install poetry
```

## Node

At least Node 20 is required.

```bash
brew install node@20
```

### PNPM

PNPM is used to manage Node dependencies.

```bash
brew install pnpm
```

## Docker

Docker is used to run the development environment.

```bash
brew install docker  # this doesn't setup the daemon, do that on your own or use Docker Desktop on macOS/Windows
```

### Docker Compose

Docker Compose is used to run the development environment.

```bash
brew install docker-compose
```

### Turborepo

Turborepo is used to manage the monorepo.

```bash
pnpm add -g turbo
```

## Environment setup

First, setup the test environment variables

```bash
./scripts/setup_test_environment_variables.sh
```

Next, start the development servers using Docker Compose.

```bash
docker compose -f docker-compose.dev.yml up
```

## Development

To start the development servers, run the following command.

```bash
turbo dev
```

This will handle all the necessary steps to start the development servers.
