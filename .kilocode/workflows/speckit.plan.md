---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
handoffs:
  - label: Create Tasks
    agent: speckit.tasks
    prompt: "Break the plan into discrete, testable tasks suitable for issue creation. Include task title, short description, estimated effort (S/M/L), and acceptance criteria."
    send: true
  - label: Create Checklist
    agent: speckit.checklist
    prompt: "Create a checklist for the following domain <DOMAIN>. (Set DOMAIN via the 'domain' task input, or use 'example.com' as a fallback if not provided. If DOMAIN is not set, replace <DOMAIN> with 'example.com'.) Produce 8-12 checklist items divided into three sections: 'tasks', 'prerequisites', and 'verification steps'. For each checklist item include a one-line description, any input required, and an example where helpful. Constrain items to be actionable and unambiguous."
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: Run `.specify/scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md, and update agent context
   - Re-evaluate Constitution Check post-design

4. **Stop and report**: Command ends after Phase 1 planning. Report branch, IMPL_PLAN path, and generated artifacts.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context in the IMPL_PLAN template above**:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task
   - See "Technical Context" section in the IMPL_PLAN template above for details.

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Agent context update**:
   - Run `.specify/scripts/bash/update-agent-context.sh <agent-name>` where `<agent-name>` is the target agent (for example: `kilocode`). The script expects an explicit agent name argument and will update the corresponding agent-specific context file.
   - Update the appropriate agent-specific context file
   - Add only new technology from current plan
   - Preserve manual additions between explicit markers. Use a clearly defined start/end pair such as:

      <!-- MANUAL_START:agent-context -->
      (manual content goes here)
      <!-- MANUAL_END:agent-context -->

      Or, for non-HTML files, use comment-style markers, e.g.:

      # MANUAL_START:agent-context
      # (manual content)
      # MANUAL_END:agent-context

      Example (agent file snippet):

      <!-- MANUAL_START:agent-context -->
      - Notes: These lines are maintained manually and will not be overwritten by the update script
      <!-- MANUAL_END:agent-context -->

      The update script must detect these markers and preserve any content between them when updating the surrounding generated content.

**Output**: data-model.md, /contracts/*, quickstart.md, agent-specific file

## Key rules

- ERROR on gate failures or unresolved clarifications.
- Log and report errors immediately.
- Escalate unresolved clarifications by flagging them in the plan output and notifying the feature owner.
- Run validation checks before merge and require passing checks for gate closure.
