---
description: Convert existing tasks into actionable, dependency-ordered GitHub issues for the feature based on available design artifacts.
tools: ['github/github-mcp-server/issue_write']
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").
1. From the executed script, extract the path to **tasks**.
1. Get the Git remote by running:

```bash
git config --get remote.origin.url
```

> [!CAUTION]
> ONLY PROCEED TO NEXT STEPS IF THE REMOTE IS A GITHUB URL

	**Validation rules with whitelist support (safe-by-default)**:

	1. **Configuration**: Support a configurable enterprise whitelist to allow trusted GitHub Enterprise hosts. Provide `ALLOWED_ENTERPRISE_DOMAINS` (comma-separated) in the environment or configuration. Examples:

	```bash
	# Example: allow github.com and two enterprise hosts
	ALLOWED_ENTERPRISE_DOMAINS=github.com,github.example.com,git.corp.example.org
	```

	If `ALLOWED_ENTERPRISE_DOMAINS` is not set, only `github.com` is accepted.

	2. **Extract remote URL** and validate against anchored patterns built from the whitelist:

	- Build safe regexes at runtime only for domains in `ALLOWED_ENTERPRISE_DOMAINS`.
	- Example anchored patterns (pseudo-code):

	  - SSH: `^git@<DOMAIN>:([a-zA-Z0-9_-]+)/([a-zA-Z0-9_.-]+?)(\.git)?$`
	  - HTTPS: `^https://<DOMAIN>/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_.-]+?)(\.git)?$`

	Replace `<DOMAIN>` with each allowed domain exactly (escape dots). Do NOT use a permissive `github\.` wildcard.

	3. **Canonicalize OWNER/REPO**:
	   - Extract capture groups 1 (OWNER) and 2 (REPO) from the matched pattern
	   - Strip `.git` suffix from REPO if present
	   - Validate OWNER matches `^[a-zA-Z0-9_-]+$` (no special chars, no path traversal)
	   - Validate REPO matches `^[a-zA-Z0-9_.-]+$` (alphanumeric, dash, dot, underscore only)
	   - Reject if OWNER or REPO contains `..`, `/`, `\`, or other path traversal sequences
	   - Store canonicalized `OWNER/REPO` as the validated repository identifier

	4. **Security checks**:
	   - If the URL does not match any allowed-domain pattern, abort with error: "Remote URL is not an allowed GitHub repository"
	   - If OWNER or REPO validation fails, abort with error: "Invalid repository identifier format"
	   - Prevent SSRF by rejecting any domain not present in `ALLOWED_ENTERPRISE_DOMAINS`
	   - Log the validated `OWNER/REPO` and matched domain for audit purposes before proceeding

	**Before creating issues**: verify the repository target supplied to the MCP server exactly matches the extracted and canonicalized `OWNER/REPO`. If they differ, fail safely with a descriptive message and do not create any issues.

	**Error handling**: When creating issues via the MCP/GitHub API, handle permission/API errors and rate-limits by:
	- Checking for 401/403 and logging a clear permission error indicating missing scopes/token
	- Checking for 403/rate_limit or 429 and backing off with retries and jitter
	- Reporting failures with the affected task IDs and the underlying error for operator inspection

1. For each task in the list, use the GitHub MCP server to create a new issue in the validated `OWNER/REPO` (the repository owner/name extracted and canonicalized from the Git remote).

> [!CAUTION]
> UNDER NO CIRCUMSTANCES EVER CREATE ISSUES IN REPOSITORIES THAT DO NOT MATCH THE VALIDATED REMOTE `OWNER/REPO`
