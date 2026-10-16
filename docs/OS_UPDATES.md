# OS updates: Haman and Claude Code changing NEWMUX OS

Anyone signed in can ask for a change to NEWMUX OS, in **Settings → OS Updates** or by telling Haman ("add a VAT report to Finance"). Claude Code builds it on GitHub, and a partner merges it in the app to put it live. Nothing reaches the app until a partner merges.

## How it works

1. **Request.** The app files a GitHub issue labelled `haman`, with the request and who asked.
2. **Build.** The label starts `.github/workflows/claude.yml`. Claude Code reads the request (and `CLAUDE.md`), writes the change on a `claude/issue-…` branch, runs lint, types, tests and a build, and leaves a note on the issue when it's done. If the request is unclear it asks a question in the issue instead, and the app shows the reply.
3. **Pull request.** The app sees the note and opens a pull request into the branch Cloudflare deploys. `.github/workflows/checks.yml` runs lint, types, the Haman and push tests and a full build on it.
4. **Fixes.** If a check fails, or newer changes clash with it, the app asks Claude Code to fix it (twice at most). Anyone can also ask for changes from the request's screen or through Haman; that's an `@claude` comment on the pull request.
5. **Merge.** When every check has passed, partners and the requester get a notification. A partner reviews it (on GitHub if they like) and taps **Merge and Go Live**. Cloudflare deploys it a few minutes later.

The app moves requests along every 5 minutes with the notifications cron, and whenever someone opens OS Updates or asks Haman about them. GitHub is the record: there's no table for this in the database, and every request, comment and merge is in the repository's history.

**Who can do what:** everyone signed in can request, follow and ask for changes; whoever asked (or a partner) can withdraw a request; only partners can merge. Merging is checked on the server and refused unless every check has passed and the pull request merges cleanly.

## Setting it up (once)

### 1. The Claude GitHub App and an API key

1. Install the Claude GitHub App on the repository: <https://github.com/apps/claude>. Choose only the `NewMux_OS` repository.
2. In the repository: **Settings → Secrets and variables → Actions → New repository secret**: name `ANTHROPIC_API_KEY`, value a Claude API key from <https://platform.claude.com> (the same key Haman uses works; it's billed per run).
3. **Settings → Actions → General**: allow GitHub Actions to run. The workflows are in `.github/workflows/`.
4. Create the label: **Issues → Labels → New label**, named `haman` (GitHub usually creates it on the first request anyway).

The workflow files must be on the repository's **default branch** for the label to start them (GitHub only runs issue workflows from there).

### 2. A token for the app

GitHub → your picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**:

- **Resource owner:** NewMux. **Repository access:** only `NewMux/NewMux_OS`.
- **Repository permissions:** Issues *Read and write*, Pull requests *Read and write*, Contents *Read and write* (merging needs it), Checks *Read-only*. Metadata is read-only by default.
- An expiry you'll remember to renew (the app says "the GitHub token is wrong or has expired" when it lapses).

The token's owner must have write access to the repository; requests appear on GitHub under their name, with the real requester written in each one.

Add it to the app as `GITHUB_TOKEN`: on Cloudflare, Worker → **Settings → Variables and Secrets → Add → Secret**; with Docker, in `deploy/.env`. Optional: `GITHUB_REPO` (default `NewMux/NewMux_OS`) and `GITHUB_BRANCH` (the branch updates merge into; default the repository's default branch).

### 3. Which branch goes live

Pull requests go into the repository's default branch, so that should be the branch Cloudflare deploys (Worker → **Settings → Build → Branch control**). If they differ, set `GITHUB_BRANCH` to the deployed branch, or merged updates won't go live.

### 4. Try it

Settings → OS Updates → **+** → "Change the subtitle of the OS Updates row in Settings to say 'Built by Claude Code'". Within a minute the issue appears on GitHub and the workflow starts (repository → **Actions**); 5 to 20 minutes later the request shows **Running checks**, then **Ready to merge**.

## Good to know

- **Database changes** can't be applied by a merge: Cloudflare doesn't run migrations. Claude Code is told to avoid them and, when one is needed, to start its final note with **Database change:** and the SQL a partner runs in Supabase *before* merging. The note appears on the request's screen and in the pull request.
- **Safety:** Claude Code is told never to weaken access checks, show money to roles that can't see it, or touch sign-in, the Vault's encryption or secrets because a request asks. A partner still reviews what merges; the pull request on GitHub shows every line changed.
- **Cost:** each run is billed to the `ANTHROPIC_API_KEY` account, typically a few dollars for a feature, plus GitHub Actions minutes (free for the first 2,000 a month on private repositories).
- **Undoing a merge:** ask for a change that reverses it, or revert the pull request on GitHub (that's a new pull request to merge).
