FROM ubuntu:24.04

# Bump here. Orca: version + sha256 of orca-linux.AppImage (sha256sum the release asset).
# upgrade: github stablyai/orca
ARG ORCA_VERSION=1.4.256
ARG ORCA_SHA256=5453149acd73ad044ad2a3e24226c3467cdc13f317b6ef4778aeb3e14f61a3dd
# upgrade: npm @anthropic-ai/claude-code
ARG CLAUDE_CODE_VERSION=2.1.322
# upgrade: npm @openai/codex
ARG CODEX_VERSION=0.167.0
# (gh api repos/anomalyco/opencode/releases/tags/vX.Y.Z -q '.assets[]|select(.name=="opencode-linux-x64.tar.gz").digest')
# upgrade: github anomalyco/opencode
ARG OPENCODE_VERSION=1.19.5
ARG OPENCODE_SHA256=588310a336fa3b9df36b3f0225b26f679d453efaad0cf3d66c3651ef3ec1647a

ENV ORCA_VERSION=${ORCA_VERSION} DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 PORT=8080 \
    NPM_CONFIG_PREFIX=/opt/npm PATH=/opt/npm/bin:/opt/orca/resources/bin:$PATH \
    OPENCODE_DISABLE_AUTOUPDATE=1 DISABLE_AUTOUPDATER=1 LIBGL_ALWAYS_SOFTWARE=1

# Toolbox the agents work with, plus the shared libraries Orca's Electron binary links
# against (the upstream Ubuntu 24.04 list). Orca starts its own Xvfb for the headless
# Electron runtime, which is the one that serves the browser client.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl wget gnupg git openssh-client nginx-light sudo tmux \
      vim nano less htop ripgrep fd-find jq unzip zip tree procps locales qrencode tini file xvfb xauth \
      python3 python3-pip python3-venv build-essential libatomic1 \
      libgtk-3-0t64 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libgbm1 libasound2t64 \
      libxtst6 libcups2t64 libdrm2 libxkbcommon0 libpango-1.0-0 libcairo2 libatspi2.0-0t64 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxrender1 libx11-xcb1 libxcb-dri3-0 libxss1 \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends nodejs gh \
  && curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh \
  && npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" "@openai/codex@${CODEX_VERSION}" \
  && npm cache clean --force && claude --version && codex --version \
  && curl -fsSL --retry 20 --retry-delay 15 --retry-all-errors -o /tmp/oc.tgz "https://github.com/anomalyco/opencode/releases/download/v${OPENCODE_VERSION}/opencode-linux-x64.tar.gz" \
  && echo "${OPENCODE_SHA256}  /tmp/oc.tgz" | sha256sum -c - \
  && tar xzf /tmp/oc.tgz -C /usr/local/bin opencode && rm /tmp/oc.tgz && opencode --version \
  # Orca ships desktop packages only: extract the AppImage (no FUSE in containers).
  && curl -fsSL --retry 20 --retry-delay 15 --retry-all-errors -o /tmp/orca.AppImage "https://github.com/stablyai/orca/releases/download/v${ORCA_VERSION}/orca-linux.AppImage" \
  && echo "${ORCA_SHA256}  /tmp/orca.AppImage" | sha256sum -c - \
  && cd /tmp && chmod +x orca.AppImage && ./orca.AppImage --appimage-extract >/dev/null \
  && mv squashfs-root /opt/orca && chmod -R a+rX /opt/orca && rm orca.AppImage && cd / \
  && ln -s /usr/bin/fdfind /usr/local/bin/fd \
  # nginx `auto` sizes from the host's cores on Railway, not the container's limit.
  && sed -i 's/^worker_processes .*/worker_processes 2;/' /etc/nginx/nginx.conf \
  && rm -f /etc/nginx/sites-enabled/default \
  # Agents run as a normal user (Claude Code refuses its skip-permissions mode as root),
  # with passwordless sudo so they can still apt-get what a repo needs.
  && userdel -r ubuntu \
  && useradd -m -u 1000 -s /bin/bash orca \
  && chown -R orca:orca /opt/npm \
  && echo 'orca ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/orca && chmod 440 /etc/sudoers.d/orca \
  && echo 'export PATH="$HOME/.local/bin:/opt/npm/bin:/opt/orca/resources/bin:$PATH"' > /etc/profile.d/local-bin.sh \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY railway-pair.mjs /opt/railway-pair.mjs
COPY entrypoint.sh /entrypoint.sh
COPY drop-file-cache /usr/local/bin/drop-file-cache

EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/entrypoint.sh"]
