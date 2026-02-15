---
description: Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts.
handoffs: 
  - label: Analyze For Consistency
    agent: speckit.analyze
    prompt: Run a project analysis for consistency
    send: true
  - label: Implement Project
    agent: speckit.implement
    prompt: Start the implementation in phases
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: Run `.specify/scripts/bash/check-prerequisites.sh --json` from repo root and parse `FEATURE_DIR` and `AVAILABLE_DOCS` list. All paths must be absolute.

    - Script invocation rules (robust handling):
       - Verify the script exists and is executable before running. Example check:

          ```bash
          SCRIPT=.specify/scripts/bash/check-prerequisites.sh
          if [ ! -f "$SCRIPT" ] || [ ! -x "$SCRIPT" ]; then
             echo "ERROR: prerequisite script not found or not executable: $SCRIPT" >&2
             exit 2
          fi
          ```

       - Capture stdout/stderr and exit code when invoking the script and include them in logs. Example:

          ```bash
          OUT=$(mktemp)
          ERR=$(mktemp)
          "$SCRIPT" --json >"$OUT" 2>"$ERR" || EXIT=$?
          EXIT=${EXIT:-0}
          if [ $EXIT -ne 0 ]; then
             echo "ERROR: $SCRIPT failed (exit=$EXIT). stderr:" >&2
             cat "$ERR" >&2
             exit $EXIT
          fi
          ```

       - Validate the returned JSON before parsing. Prefer using `jq` or a simple Node/JS JSON parse to fail fast. Example (jq):

          ```bash
          if ! jq empty "$OUT" >/dev/null 2>&1; then
             echo "ERROR: Invalid JSON returned by $SCRIPT" >&2
             echo "Stdout:" >&2; cat "$OUT" >&2
             echo "Stderr:" >&2; cat "$ERR" >&2
             exit 3
          fi
          ```

       - When parsing, always check required keys exist (`FEATURE_DIR`, `AVAILABLE_DOCS`) and are of the expected type (string/array). If keys are missing or invalid, fail fast with a clear message that includes the script path, exit code (if non-zero), and stderr contents for diagnostics.

    - Quoting recommendation: Prefer double quotes for user-provided descriptions when safe: `"I'm Groot"`. Use single-quote escaping (`'I'\''m Groot'`) only as a last-resort when double quotes cannot be used.

2. **Load design documents**: Read from `FEATURE_DIR`:
   - **Required**: `plan.md` (tech stack, libraries, structure), `spec.md` (user stories with priorities)
   - **Optional**: `data-model.md` (entities), `contracts/` (API endpoints), `research.md` (decisions), `quickstart.md` (test scenarios)
   - Validation: After `check-prerequisites.sh` reports `FEATURE_DIR`, ensure required files exist. If `plan.md` or `spec.md` is missing, abort generation or create a clear blocking task in `tasks.md` that lists the missing files and instructions to add them. Example behavior:

     - If both `plan.md` and `spec.md` exist: continue normally.
     - If one or both are missing: create `tasks.md` with a top-level blocking task (T000) that enumerates the missing files and provides exact instructions (paths and templates) to produce them, then stop further task generation until the missing artifacts are provided.

   - When reporting missing files, reference `FEATURE_DIR`, `plan.md`, `spec.md`, and `tasks.md` explicitly so reviewers can locate and remediate the gap.

3. **Execute task generation workflow**:
   - Load plan.md and extract tech stack, libraries, project structure
   - Load spec.md and extract user stories with their priorities (P1, P2, P3, etc.)
   - If data-model.md exists: Extract entities and map to user stories
   - If contracts/ exists: Map endpoints to user stories
   - If research.md exists: Extract decisions for setup tasks
   - Generate tasks organized by user story (see Task Generation Rules below)
   - Generate dependency graph showing user story completion order
   - Create parallel execution examples per user story
   - Validate task completeness (each user story has all needed tasks, independently testable)

4. **Generate tasks.md**: Use `.specify/templates/tasks-template.md` as structure, fill with:
   - Correct feature name from plan.md
   - Phase 1: Setup tasks (project initialization)
   - Phase 2: Foundational tasks (blocking prerequisites for all user stories)
   - Phase 3+: One phase per user story (in priority order from spec.md)
   - Each phase includes: story goal, independent test criteria, tests (if requested), implementation tasks
   - Final Phase: Polish & cross-cutting concerns
   - All tasks must follow the strict checklist format (see Task Generation Rules below)
   - Clear file paths for each task
   - Dependencies section showing story completion order
   - Parallel execution examples per story
   - Implementation strategy section (MVP first, incremental delivery)

5. **Report**: Output path to generated tasks.md and summary:
   - Total task count
   - Task count per user story
   - Parallel opportunities identified
   - Independent test criteria for each story
   - Suggested MVP scope (typically just User Story 1)
   - Format validation: Confirm ALL tasks follow the checklist format (checkbox, ID, labels, file paths)

Context for task generation: $ARGUMENTS

The tasks.md should be immediately executable - each task must be specific enough that an LLM can complete it without additional context.

## Task Generation Rules

**CRITICAL**: Tasks MUST be organized by user story to enable independent implementation and testing.

**Tests are OPTIONAL**: Only generate test tasks if explicitly requested in the feature specification or if user requests TDD approach.

### Checklist Format (REQUIRED)

Every task MUST strictly follow this format:

```text
- [ ] [TaskID] [P?] [Story?] Description with file path
```

**Format Components**:

1. **Checkbox**: ALWAYS start with `- [ ]` (markdown checkbox)
2. **Task ID**: Sequential number (T001, T002, T003...) in execution order
3. **[P] marker**: Include ONLY if task is parallelizable (different files, no dependencies on incomplete tasks)
4. **[Story] label**: REQUIRED for user story phase tasks only
   - Format: [US1], [US2], [US3], etc. (maps to user stories from spec.md)
   - Setup phase: NO story label
   - Foundational phase: NO story label  
   - User Story phases: MUST have story label
   - Polish phase: NO story label
5. **Description**: Clear action with exact file path

**Examples**:

- ✅ CORRECT: `- [ ] T001 Create project structure per implementation plan`
- ✅ CORRECT: `- [ ] T005 [P] Implement authentication middleware in src/middleware/auth.py`
- ✅ CORRECT: `- [ ] T012 [P] [US1] Create User model in src/models/user.py`
- ✅ CORRECT: `- [ ] T014 [US1] Implement UserService in src/services/user_service.py`
- ❌ WRONG: `- [ ] Create User model` (missing ID and Story label)
- ❌ WRONG: `T001 [US1] Create model` (missing checkbox)
- ❌ WRONG: `- [ ] [US1] Create User model` (missing Task ID)
- ❌ WRONG: `- [ ] T001 [US1] Create model` (missing file path)

### Task Organization

1. **From User Stories (spec.md)** - PRIMARY ORGANIZATION:
   - Each user story (P1, P2, P3...) gets its own phase
   - Map all related components to their story:
     - Models needed for that story
     - Services needed for that story
     - Endpoints/UI needed for that story
     - If tests requested: Tests specific to that story
   - Mark story dependencies (most stories should be independent)

2. **From Contracts**:
   - Map each contract/endpoint → to the user story it serves
   - If tests requested: Each contract → contract test task [P] before implementation in that story's phase

3. **From Data Model**:
   - Map each entity to the user story(ies) that need it
   - If entity serves multiple stories: Put in earliest story or Setup phase
   - Relationships → service layer tasks in appropriate story phase

4. **From Setup/Infrastructure**:
   - Shared infrastructure → Setup phase (Phase 1)
   - Foundational/blocking tasks → Foundational phase (Phase 2)
   - Story-specific setup → within that story's phase

### Phase Structure

- **Phase 1**: Setup (project initialization)
- **Phase 2**: Foundational (blocking prerequisites - MUST complete before user stories)
- **Phase 3+**: User Stories in priority order (P1, P2, P3...)
  - Within each story: Tests (if requested) → Models → Services → Endpoints → Integration
  - Each phase should be a complete, independently testable increment
- **Final Phase**: Polish & Cross-Cutting Concerns
