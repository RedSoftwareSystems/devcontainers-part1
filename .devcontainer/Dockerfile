ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl jq openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Always run as a non-root user inside the container
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=${USER_UID}
RUN groupadd --gid ${USER_GID} ${USERNAME} \
    && useradd --uid ${USER_UID} --gid ${USER_GID} -m ${USERNAME}

WORKDIR /workspace
USER ${USERNAME}
