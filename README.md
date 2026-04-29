# devcontainers-part1

> Companion project for the Medium article  
> **"The End of Localhost: Why Modern Engineering Demands Dev Containers — Part 1"**

---

## Overview

This repository demonstrates the core concepts introduced in Part 1 of the Dev Containers series. It contains a minimal **Express + TypeScript** API wired up with a fully configured Dev Container so that any developer — on any machine — gets an identical, reproducible development environment in seconds.

Key things this repo shows:

- A custom `Dockerfile` that pins the Node.js version and runs as a **non-root user**
- The difference between `containerEnv` and `remoteEnv` in `devcontainer.json`
- A `postCreateCommand` that bootstraps the project automatically on first launch
- Recommended VS Code extensions and settings shipped with the repo
- A working TypeScript/Express application with ESLint and Prettier pre-configured
- SSH agent forwarding so `git push` and `git pull` over SSH work without copying private keys into the image
- Host `~/.gitconfig` mounted read-only so every commit carries the correct author identity

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine on Linux) | Builds and runs the dev container |
| [Visual Studio Code](https://code.visualstudio.com/) + [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) | Opens the project inside the container |
| **OR** [`@devcontainers/cli`](https://github.com/devcontainers/cli) | Headless / CI usage without VS Code |

---

## Getting Started

### Option A — VS Code (recommended)

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/devcontainers-part1.git
   cd devcontainers-part1
   ```

2. **Open the folder in VS Code**

   ```bash
   code .
   ```

3. **Accept the "Reopen in Container" prompt**

   VS Code detects `.devcontainer/devcontainer.json` and shows a notification in the bottom-right corner. Click **Reopen in Container**. Docker builds the image, installs npm dependencies via `postCreateCommand`, and drops you into a fully configured shell — all automatically.

> **Tip:** You can also trigger this manually via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → **Dev Containers: Reopen in Container**.

---

### Option B — Environment variables (secrets)

Before opening the container, export the secrets that `remoteEnv` reads from your host:

```bash
cp .env.example .env          # for local reference only — never committed
export API_BASE_URL=http://localhost:3000
export INTERNAL_API_KEY=your-actual-key
```

These values are injected into your shell inside the container at startup via `remoteEnv` in `devcontainer.json`. They are **never baked into the image**.

---

## Using the CLI

If you prefer a headless workflow (CI, scripts, or non-VS Code editors), use the [`@devcontainers/cli`](https://github.com/devcontainers/cli):

```bash
# 1. Build the dev container image
devcontainer build --workspace-folder .

# 2. Start the container
devcontainer up --workspace-folder .

# 3. Run a command inside the running container
devcontainer exec --workspace-folder . npm run dev
```

---

## Project Structure

```
devcontainers-part1/
├── .devcontainer/
│   ├── Dockerfile          # Custom image: Node 20 slim + non-root user
│   └── devcontainer.json   # Container config: env, mounts, extensions
├── src/
│   ├── index.ts            # Express app entry point
│   └── routes/
│       └── health.ts       # GET /health endpoint
├── .env.example            # Template for local secrets (never commit .env)
├── .eslintrc.json          # ESLint config (TypeScript-aware)
├── .gitignore
├── .prettierrc             # Prettier formatting rules
├── package.json
├── tsconfig.json           # TypeScript compiler options
└── README.md
```

---

## Key Concepts

### `containerEnv` vs `remoteEnv`

Both keys in `devcontainer.json` inject environment variables, but at **different stages** of the container lifecycle:

| Property | When it's resolved | Source | Use for |
|---|---|---|---|
| `containerEnv` | On the **host**, before the container starts | Host env or literal strings | Non-sensitive config needed during image initialisation (e.g. `TZ`, `NODE_ENV`) |
| `remoteEnv` | After the container starts, in the **developer's shell** | `${localEnv:VAR}` reads from the host | Secrets and per-developer values that must **never** be baked into the image |

Because `remoteEnv` uses `${localEnv:VAR}`, secrets stay on your host machine. They are never written to the image layer, the container filesystem, or version control.

### Non-root user

The `Dockerfile` creates a `vscode` user (UID 1000) and switches to it before the final `CMD`. Running as non-root inside containers is a security best practice: it limits the blast radius of a compromised process and mirrors the principle of least privilege.

```dockerfile
ARG USERNAME=vscode
RUN groupadd --gid ${USER_GID} ${USERNAME} \
    && useradd --uid ${USER_UID} --gid ${USER_GID} -m ${USERNAME}
USER ${USERNAME}
```

### `postCreateCommand`

```json
"postCreateCommand": "npm install"
```

This hook runs **once**, immediately after the container is created. It installs npm dependencies automatically so developers never need to remember a manual setup step. The `node_modules` directory lives inside the container, keeping the host filesystem clean.

### SSH Agent Forwarding

The SSH agent socket from the host is bind-mounted into the container at a fixed path, and `SSH_AUTH_SOCK` is pointed at it via `remoteEnv`:

```json
"mounts": [
  "source=${localEnv:SSH_AUTH_SOCK},target=/ssh-agent,type=bind"
],
"remoteEnv": {
  "SSH_AUTH_SOCK": "/ssh-agent"
}
```

The `ssh` binary (`openssh-client`) is installed in the `Dockerfile` so Git can use the forwarded agent for all SSH operations. Your private keys never leave the host.

#### Platform-specific notes

| Platform | How it works | What to change |
|---|---|---|
| **Linux** (raw Docker) | `SSH_AUTH_SOCK` points to a Unix socket file — the bind mount works as-is | Nothing |
| **macOS with OrbStack / Colima** | Same as Linux; the socket is accessible to the container runtime | Nothing |
| **macOS with Docker Desktop** | Docker Desktop runs in a VM and cannot bind-mount macOS Unix sockets directly. It exposes a built-in forwarded socket instead | Remove the SSH mount entry and set `"SSH_AUTH_SOCK": "/run/host-services/ssh-auth.sock"` in `remoteEnv` |
| **Windows WSL2** | The Windows OpenSSH agent exposes a socket inside WSL2, typically auto-set in `$SSH_AUTH_SOCK` | Ensure the OpenSSH Authentication Agent service is running on Windows (`Get-Service ssh-agent`) |

> **Before opening the container**, confirm that your SSH agent is running on the host and your key is loaded:
> ```bash
> ssh-add -l       # should list your key(s)
> ```
> If it returns "Could not open a connection", start the agent with `eval "$(ssh-agent -s)"` then `ssh-add ~/.ssh/id_ed25519`.

### Git Identity

`~/.gitconfig` is bind-mounted from the host into the container as read-only:

```json
"source=${localEnv:HOME}/.gitconfig,target=/home/vscode/.gitconfig,type=bind,consistency=cached,readonly"
```

This means `git config user.name` and `git config user.email` — as well as any aliases, signing keys, or other settings you have configured on your host — are automatically available inside the container without any extra steps. The `readonly` flag prevents accidental writes from inside the container from modifying your host configuration.

> **Windows users:** replace `${localEnv:HOME}` with `${localEnv:USERPROFILE}` in the mount source. The target path stays the same (`/home/vscode/.gitconfig`).

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Returns a welcome message and link to the repo |
| `GET` | `/health` | Returns service status, current timestamp, and process uptime |

### Example responses

**`GET /`**
```json
{
  "message": "Dev Containers — Part 1 sample API",
  "docs": "https://github.com/your-org/devcontainers-part1"
}
```

**`GET /health`**
```json
{
  "status": "ok",
  "timestamp": "2024-01-25T12:00:00.000Z",
  "uptime": 42.3
}
```

---

## Environment Variables

All variables are documented in `.env.example`. Copy it to `.env` for local reference, but rely on shell exports for values consumed by `remoteEnv`.

| Variable | Where it's used | Description |
|----------|-----------------|-------------|
| `API_BASE_URL` | `remoteEnv` in `devcontainer.json` | Base URL of the API; defaults to `http://localhost:3000` |
| `INTERNAL_API_KEY` | `remoteEnv` in `devcontainer.json` | Secret API key — **never** commit a real value |
| `SSH_AUTH_SOCK` | `remoteEnv` in `devcontainer.json` | Path to the SSH agent socket inside the container (fixed at `/ssh-agent`); source on the host is read from the same-named env var via the bind mount |
| `NODE_ENV` | `containerEnv` in `devcontainer.json` | Node environment (`development` by default) |
| `TZ` | `containerEnv` in `devcontainer.json` | Timezone inside the container (`UTC`) |
| `PORT` | Read in `src/index.ts` at runtime | Port the Express server listens on (default: `3000`) |

---

## License

MIT © your-org
