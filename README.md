# Deploy and Host Orca Server on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/orca-server?referralCode=sLjDXb&utm_medium=integration&utm_source=button&utm_campaign=orca-server)

[Orca](https://github.com/stablyai/orca) is the open-source IDE for running a fleet of coding agents in parallel: Claude Code, Codex, OpenCode and 40 more CLI agents, each in its own git worktree, with terminals, diffs, source control and GitHub checks in one window. This template runs Orca's headless server (`orca serve`) on Railway, so your agents keep working with the laptop closed and you drive them from a browser, the Orca desktop app or the Orca phone app.

## About Hosting Orca Server

One service, one volume. The pinned Orca release (v1.4.256, checksum-verified at build) runs headless behind nginx on your Railway domain. It serves the Orca web client and the WebSocket that the browser, the desktop app and the phone app connect to.

- **Use it from any browser.** The template runs Orca's full runtime, the one that ships the browser client, so a laptop, tablet or phone with a browser is enough. No install, no Tailscale.
- **Locked by Orca's own pairing.** Every connection needs a paired device token. Someone who finds the URL sees only an empty "Connect to Orca" form. The desktop and phone apps connect through this same lock. A basic-auth gateway in front would have locked them out.
- **A pairing page instead of digging through logs.** Open `https://<your-domain>/railway-pair` and sign in with the generated `ORCA_SETUP_PASSWORD`. The page has a one-click browser sign-in, the link for the desktop app, a QR code for the phone app, and a button that revokes every paired device. The pairing credential Orca prints at startup is kept out of the deploy logs.
- **Agents preinstalled and pinned:** Claude Code 2.1.300, Codex 0.162.1 and OpenCode 1.19.0, next to `git`, `gh`, Node 22, Python 3 + `uv`, `build-essential`, `ripgrep`, `jq` and `tmux`. Install any other agent from an Orca terminal.
- **A normal user with sudo.** Agents run as user `orca`, so Claude Code's skip-permissions mode works (it refuses that mode as root). Passwordless `sudo` is there for `apt-get`.
- **Everything persists.** `/home/orca` is the volume: Orca's state, paired devices and agent sessions (`~/.config/orca`), agent logins (`~/.claude`, `~/.codex`), your repos in `~/projects`, and dotfiles.

## Common Use Cases

- Run several Claude Code or Codex agents in parallel worktrees on one repo, close the laptop, and review the diffs from your phone
- One always-on Orca workspace that your browser, the Orca desktop app and the Orca phone app all share
- Use your Claude or ChatGPT subscription from devices where you can't install the CLIs
- Give long agent tasks a box that never sleeps, sized for builds and tests

## Dependencies for Orca Server Hosting

- None. Single service, no database. You bring an agent login: a Claude or ChatGPT subscription, an API key, or OpenCode's free models.

### Deployment Dependencies

- [Orca](https://github.com/stablyai/orca) (MIT) and its [Remote Orca Servers docs](https://www.onorca.dev/docs/remote-servers)
- [Claude Code](https://claude.com/product/claude-code), [Codex CLI](https://developers.openai.com/codex/cli), [OpenCode](https://opencode.ai)
- [GitHub CLI](https://cli.github.com/)

### Implementation Details

**1. Pair your first device.** Copy `ORCA_SETUP_PASSWORD` from the service's Variables tab and open `https://<your-domain>/railway-pair` (any username, that password).

- **Browser:** click **Open Orca in this browser**. The browser stays paired; bookmark the page it opens.
- **Orca desktop app:** Settings → Remote Orca Servers → Add Server, then paste the `orca://pair?...` link.
- **Orca phone app:** click **Create a phone-app link**, then in the app choose **Pair** and scan the QR code. Phone links are separate because Orca scopes them for mobile.

Links stay valid until you revoke them, and paired devices stay paired across redeploys. **Revoke all and make a new link** signs every device out. Making a phone link or revoking restarts Orca for a few seconds; terminals and agents keep running.

**2. Log an agent in.** Open a terminal in Orca. It runs on the server as `orca`.

- **Claude:** run `claude auth login`, open the URL it prints, then paste the code back. Or set `ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`.
- **Codex:** run `codex login --device-auth`, or set `OPENAI_API_KEY` to log Codex in with a key on first boot. To change that key later, run `codex logout` and redeploy.
- **OpenCode (free models, no key):** run `opencode` and pick a model marked Free.

**3. Add a project.** **Add project** → clone a Git URL into `~/projects`. Set `GH_TOKEN` and private clones, `git push`, `gh pr create` and Orca's PR and checks panels work without a login (the box runs `gh auth setup-git` at boot). The box sets a placeholder commit identity; set yours once with `git config --global user.name/user.email`.

**Upgrading:** Orca and the agent versions are pinned in the Dockerfile, so every deploy is the tested build. Redeploying picks up bumps from this repo. Orca never updates itself in place. Your data on the volume is never touched, and newer Orca releases migrate their state on load.

Notes and limits:

- **RAM:** about 500 MB idle on Railway (Orca's runtime with its headless Chromium, the terminal daemon, the pairing page and nginx; measured 2026-11-09). One OpenCode session took it to about 1 GB, and builds and tests need more. Use the Hobby plan: the Trial plan's 1 GB starts Orca but not much of an agent, and on the Free plan's 0.5 GB the template shows a page saying so instead of starting Orca.
- The image is about 4 GB, so the first deploy takes a few minutes to pull it.
- **Orca's remote server mode is beta upstream.** Expect rough edges between versions.
- **This server runs arbitrary commands.** Agents and Orca terminals have a shell with passwordless sudo on this box. Orca's device pairing and `ORCA_SETUP_PASSWORD` are all that protect it: keep the password secret and treat pairing links like passwords.
- Anything installed outside `/home/orca` is lost on redeploy. Put tools in `~/.local/bin`.
- No Docker daemon in the box, and no GPU. Orca's built-in browser panes and computer-use features are untested here.
- `ORCA_PAIRING_ADDRESS` (e.g. `https://orca.example.com`) makes Orca advertise a custom domain instead of the Railway one.

## Why Deploy Orca Server on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying Orca Server on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.
