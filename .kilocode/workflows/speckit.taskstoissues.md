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

	**Validation rules**:
	- Accept SSH: `git@github.com:OWNER/REPO.git`
	- Accept HTTPS: `https://github.com/OWNER/REPO` or `https://github.com/OWNER/REPO.git`
	- Accept Enterprise GitHub hosts: `git@github.example.com:OWNER/REPO.git` or `https://github.example.com/OWNER/REPO(.git)`
	- Extract `OWNER/REPO` and store as the target repository identifier for issue creation
	- If the URL cannot be parsed as a GitHub-hosted repository, abort with a clear error message and exit code (do not attempt to create issues)

	**Before creating issues**: verify the repository target supplied to the MCP server matches the extracted `OWNER/REPO`. If they differ, fail safely with a descriptive message and do not create any issues.

	**Error handling**: When creating issues via the MCP/GitHub API, handle permission/API errors and rate-limits by:
	- Checking for 401/403 and logging a clear permission error indicating missing scopes/token
	- Checking for 403/rate_limit or 429 and backing off with retries and jitter
	- Reporting failures with the affected task IDs and the underlying error for operator inspection

1. For each task in the list, use the GitHub MCP server to create a new issue in the repository that is representative of the Git remote.

> [!CAUTION]
> UNDER NO CIRCUMSTANCES EVER CREATE ISSUES IN REPOSITORIES THAT DO NOT MATCH THE REMOTE URL
