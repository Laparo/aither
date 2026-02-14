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

	**Validation rules with explicit regex constraints**:
	
	1. **Extract remote URL** and validate against these patterns:
	   - SSH format: `^git@github\.com:([a-zA-Z0-9_-]+)/([a-zA-Z0-9_.-]+?)(\.git)?$`
	   - HTTPS format: `^https://github\.com/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_.-]+?)(\.git)?$`
	   - Enterprise SSH: `^git@github\.[a-zA-Z0-9.-]+:([a-zA-Z0-9_-]+)/([a-zA-Z0-9_.-]+?)(\.git)?$`
	   - Enterprise HTTPS: `^https://github\.[a-zA-Z0-9.-]+/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_.-]+?)(\.git)?$`
	
	2. **Canonicalize OWNER/REPO**:
	   - Extract capture groups 1 (OWNER) and 2 (REPO) from the matched pattern
	   - Strip `.git` suffix from REPO if present
	   - Validate OWNER matches `^[a-zA-Z0-9_-]+$` (no special chars, no path traversal)
	   - Validate REPO matches `^[a-zA-Z0-9_.-]+$` (alphanumeric, dash, dot, underscore only)
	   - Reject if OWNER or REPO contains `..`, `/`, `\`, or other path traversal sequences
	   - Store canonicalized `OWNER/REPO` as the target repository identifier
	
	3. **Security checks**:
	   - If the URL does not match any GitHub pattern, abort with error: "Remote URL is not a GitHub repository"
	   - If OWNER or REPO validation fails, abort with error: "Invalid repository identifier format"
	   - Prevent SSRF by rejecting non-GitHub domains (only `github.com` or `github.*` enterprise hosts)
	   - Log the canonicalized `OWNER/REPO` for audit purposes before proceeding

	**Before creating issues**: verify the repository target supplied to the MCP server exactly matches the extracted and canonicalized `OWNER/REPO`. If they differ, fail safely with a descriptive message and do not create any issues.

	**Error handling**: When creating issues via the MCP/GitHub API, handle permission/API errors and rate-limits by:
	- Checking for 401/403 and logging a clear permission error indicating missing scopes/token
	- Checking for 403/rate_limit or 429 and backing off with retries and jitter
	- Reporting failures with the affected task IDs and the underlying error for operator inspection

1. For each task in the list, use the GitHub MCP server to create a new issue in the repository that is representative of the Git remote.

> [!CAUTION]
> UNDER NO CIRCUMSTANCES EVER CREATE ISSUES IN REPOSITORIES THAT DO NOT MATCH THE REMOTE URL
