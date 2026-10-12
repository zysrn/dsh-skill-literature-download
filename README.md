# @zysrn/dsh-skill-literature-download

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that packages the
**`literature-download-automation`** skill as an installable dsh bundle.

Batch-download full-text PDFs for a list of DOIs or titles through a real browser, using your own
institutional access (CARSI / 校园统一身份认证 / VPN) plus open-access routes.

## Why this plugin exists

A skill is normally a directory you copy into `~/.dsh/skills` by hand. That is fine for one machine
and awkward for everything else: nothing versions it, nothing updates it, and every new profile
needs the copy repeated.

This package makes the skill a **normal npm dependency**. Installing it registers a skill root at
DSH's standard bundled-skill rank, so the skill appears in every agent's catalog in that deployment
with no manual file placement.

## Install

```bash
dsh plugin --profile web add @zysrn/dsh-skill-literature-download
```

Then register the bundle so its patch layer is applied — add it to `dsh.profile.bundles` in the
profile's `package.json`:

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@zysrn/dsh-skill-literature-download"
      ]
    }
  }
}
```

Restart the profile. The skill is then available to the model and to the `/` command surface as
`literature-download-automation`.

### If you already installed the skill by hand

Remove the manual copy first:

```bash
rm -rf ~/.dsh/skills/literature-download-automation
```

Both copies resolve to the same skill name, and DSH's discovery ranks the user directory (`user-dsh`,
rank 400) *above* a package's bundled root (rank 600). With both present the catalog still shows one
skill, but it silently serves the hand-installed copy — so editing the package would appear to have
no effect. Removing the manual copy leaves the package as the single source.

## Verify

Check that the plugin's row reached the composed profile tree:

```bash
dsh --profile web --dump-config | grep dsh-skill-literature-download
```

The row appears as an `insert` entry named `@zysrn/dsh-skill-literature-download`. Then ask the agent
to download a paper — the skill lists as `literature-download-automation` in its catalog.

## What the skill does

Given a list of DOIs or titles, it drives a real browser to fetch each PDF, then verifies the result.
It ships two interchangeable drivers:

| Driver | How it works | When to use |
|---|---|---|
| **CDP script** *(default)* | Launches its own Edge instance over the Chrome DevTools Protocol and downloads through it | Headless-friendly, no extra software |
| **BrowserSkill** *(fallback)* | Reuses your already-logged-in browser through Tencent BrowserSkill | When the publisher needs your real session |

Both then verify every file is a real PDF (magic bytes + page count) and write a manifest.

### Boundaries it will not cross

These are part of the skill's contract, not configuration:

- **Two legitimate routes only** — open access, or your institution's paid subscription.
  No pirate mirrors.
- **It never asks for your password.** Campus SSO, CARSI, and QR logins must be completed by you.
  The agent automates only what happens *after* you are logged in. If you offer your password, it
  will refuse it.
- **No paywall circumvention and no CAPTCHA solving.** A human-verification challenge is handed back
  to you by design.
- **Unavailable papers are reported as failures**, with the technical reason, rather than worked
  around.

## Layout

```
lib/index.js                 mounts the bundled skill root
cordis.patch.yml             the bundle patch that inserts this plugin's row
skills/literature-download-automation/
  SKILL.md                   the skill body and its frontmatter
  scripts/                   CDP driver, browser driver, verifier, self-check
  examples/job.example.json  the job-list format
```

The implementation is deliberately small. It does not re-implement skill discovery — it delegates to
the first-party `@deepseek-ai/dsh-skill-filesystem` provider and points that provider's single
bundled root at this package's own `skills/` directory. Reusing the first-party provider keeps
parsing, name validation, and invocation semantics identical to a hand-installed skill.

The root is resolved from `import.meta.url`, so it is correct regardless of which profile loaded the
plugin or what the process working directory is.

## Requirements

- Node.js >= 18
- A DSH deployment providing `@deepseek-ai/dsh-skill-filesystem`

The skill's own scripts additionally need Python 3 and, for the CDP driver,
[`websocket-client`](https://pypi.org/project/websocket-client/).

## Privacy

The skill contains no credentials and makes no network calls of its own beyond the publisher sites
you ask it to visit. It includes a credential-leak self-check (`scripts/selfcheck.py`) that scans the
bundle for token-shaped strings before release.

## License

MIT © zysrn
