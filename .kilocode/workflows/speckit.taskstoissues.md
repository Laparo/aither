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

   **Error handling**: If the script exits with a non-zero code, log `stderr` and the exit code, display a descriptive error message to the operator, and abort the workflow immediately — do NOT proceed to issue creation.
2. From the executed script, extract the path to **tasks**.
3. Get the Git remote by running:

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

	- SSH: `^git@<DOMAIN>:([a-zA-Z0-9_\-]+)/([a-zA-Z0-9_.\-]+?)(\.git)?$`
	- HTTPS: `^https://<DOMAIN>/([a-zA-Z0-9_\-]+)/([a-zA-Z0-9_.\-]+?)(\.git)?$`

	Replace `<DOMAIN>` with each allowed domain exactly (escape dots). Do NOT use a permissive `github\.` wildcard.

	3. **Canonicalize OWNER/REPO**:
	   - Extract capture groups 1 (OWNER) and 2 (REPO) from the matched pattern
	   - Strip `.git` suffix from REPO if present
	   - Validate OWNER matches `^[a-zA-Z0-9_\-]+$` (no special chars, no path traversal)
	   - Validate REPO matches `^[a-zA-Z0-9_.\-]+$` (alphanumeric, dash, dot, underscore only)
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
	- Checking for 403/rate_limit or 429 and backing off with retries and jitter (maxRetries=5, baseBackoff=500 ms, maxBackoff=10 s, jitter ±50 %)
	- Reporting failures with the affected task IDs and the underlying error for operator inspection

4. For each task in the list, use the GitHub MCP server to create a new issue in the validated `OWNER/REPO` (the repository owner/name extracted and canonicalized from the Git remote).

> [!CAUTION]
> UNDER NO CIRCUMSTANCES EVER CREATE ISSUES IN REPOSITORIES THAT DO NOT MATCH THE VALIDATED REMOTE `OWNER/REPO`

5. Issue field mapping and dependency handling

	For each task (processed in dependency order when a dependency field exists in the tasks file), follow these rules when creating the GitHub issue:

	- **Title**: Use the task title as the issue title (truncate to 256 characters if necessary).
	- **Body**: Construct the issue body as: task description followed by a `\n\n` separator and a link list to `AVAILABLE_DOCS` (one per line). Include a small metadata block at the end listing original task ID and source path, e.g. `Source: specs/feature-x/tasks.md#T000`.
	- **Labels**: If the task contains label metadata, add those labels to the issue. Normalize label names (lowercase, replace spaces with `-`) before creating them.
	- **Milestone**: If a milestone is specified in task metadata, attach it to the created issue.
	- **Assignee**: If an assignee is provided and validated against the repo (exists in org), add it; otherwise skip with a warning in the operation log.
	- **Dependencies**: Maintain a mapping `taskId -> createdIssueNumber` while creating issues. When a task lists dependencies, create the dependent issues in the given order and after creating all issues, update the issue bodies to include dependency links such as `Depends on #<issueNumber>` for each referenced predecessor.
	- **Ordering**: Create issues in dependency order where possible; when cycles are detected, break cycles deterministically (natural sort by task id, e.g. T2 < T10) and log the cycle for manual review.
	- **Error handling**: On partial failures, record which task IDs failed and abort further creations if more than 10% of tasks in the batch fail; otherwise continue and report failures at the end.

	Persistence of mapping: keep an in-memory map during execution and write a JSON summary file `AVAILABLE_DOCS/issue-mapping.json` with `taskId -> issueNumber` for operator inspection and follow-up automation. Before writing, ensure the target directory exists (`mkdir -p "$(dirname "$path")"` or equivalent) to avoid ENOENT failures.
