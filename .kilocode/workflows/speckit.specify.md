---
description: Create or update the feature specification from a natural language feature description.
handoffs:
  - label: Build Technical Plan
    agent: speckit.plan
    prompt: "Create a plan for the spec. Use {TECH_STACK} as a placeholder; replace it with the target stack if known or leave it as a placeholder. List only necessary parameters; do not include implementation details."
  - label: Clarify Spec Requirements
    agent: speckit.clarify
    prompt: Clarify specification requirements
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

Note: The text the user typed after `/speckit.specify` is the feature description and is always available to the workflow.

- `$ARGUMENTS` behaviour: `$ARGUMENTS` is a template placeholder that will be substituted with the exact description the user provided. When rendering templates or invoking helper scripts, substitute `$ARGUMENTS` with the user's description value.
- Empty-invocation rule: If the user invoked `/speckit.specify` with no arguments, `$ARGUMENTS` will be empty; treat this as "no description provided" and follow the error behavior defined below. `$ARGUMENTS` should remain the literal empty string only in that case — it must not be treated as a literal placeholder when a description exists.
- Substitution guarantee: Consumers of this workflow may assume the feature description is available (either as a non-empty string in `$ARGUMENTS` or empty when omitted). Do not ask the user to repeat the description unless `$ARGUMENTS` is empty.

## Outline

The text the user typed after `/speckit.specify` in the triggering message **is** the feature description. Assume you always have it available in this conversation even if `$ARGUMENTS` appears literally below. Do not ask the user to repeat it unless they provided an empty command.

Given that feature description, do this:

   1. **Generate a concise short name** (2-4 words) for the branch:
   - Analyze the feature description and extract the most meaningful keywords
   - Create a 2-4 word short name that captures the essence of the feature
   - Use action-noun format when possible (e.g., "add-user-auth", "fix-payment-bug")
   - Preserve technical terms and acronyms (OAuth2, API, JWT, etc.)
   - Keep it concise but descriptive enough to understand the feature at a glance
   - Examples:
     - "I want to add user authentication" → "user-auth"
     - "Implement OAuth2 integration for the API" → "oauth2-api-integration"
     - "Create a dashboard for analytics" → "analytics-dashboard"
     - "Fix payment processing timeout bug" → "fix-payment-timeout"

2. **Check for existing branches before creating new one**:

   a. First, fetch all remote branches to ensure we have the latest information:

      ```bash
      git fetch --all --prune
      ```

   b. Find the highest feature number across all sources for the short-name:
      - Remote branches: `git ls-remote --heads origin | grep -E 'refs/heads/[0-9]+-<short-name>$'`
      - Local branches: `git branch | grep -E '^[* ]*[0-9]+-<short-name>$'`
      - Specs directories: Check for directories matching `specs/[0-9]+-<short-name>`

      Note: Replace the `<short-name>` placeholder with the actual short name (e.g., `user-auth`). Example shell pattern using a variable:

      ```bash
      SHORT=user-auth
      git ls-remote --heads origin | grep -E "refs/heads/[0-9]+-${SHORT}$"
      git branch | grep -E "^[* ]*[0-9]+-${SHORT}$"
      ls -d specs/[0-9]+-${SHORT}
      ```

      Guidance: `<short-name>` is a placeholder you must replace with the generated short name. If you need a more permissive match use a concrete regex that restricts allowed characters (for example: `^[0-9]+-[a-z0-9-]+$`), or set the short name in a shell variable as shown above (`SHORT=feature-x`) and reuse it to avoid manual substitution mistakes.

   c. Determine the next available number:
      - Extract all numbers from all three sources
      - Find the highest number N
      - Use N+1 for the new branch number

   d. Run the script `.specify/scripts/bash/create-new-feature.sh --json "$ARGUMENTS"` with the calculated number and short-name.
      - Parameter rule: `$ARGUMENTS` must include the feature description (and any JSON flags). Do NOT pass the description again as a separate trailing positional argument. The script invocation must use `--json "$ARGUMENTS" --number <N> --short-name "<short-name>"` so that the description is consumed from the JSON payload consistently.
      - Pass `--number N+1` and `--short-name "your-short-name"` and include the feature description inside `$ARGUMENTS` (do not repeat it as a separate trailing positional argument).
      - Bash example: `.specify/scripts/bash/create-new-feature.sh --json "$ARGUMENTS" --number 5 --short-name "user-auth"`
      - PowerShell example (invoke via WSL/Git Bash): `bash -lc '.specify/scripts/bash/create-new-feature.sh --json "$ARGUMENTS" --number 5 --short-name "user-auth"'`
      - Example (wrong): `.specify/scripts/bash/create-new-feature.sh --number 5 --short-name "user-auth" "Add user authentication"` ← do not do this. The description must be inside `$ARGUMENTS`.

   **IMPORTANT**:
   - Check all three sources (remote branches, local branches, specs directories) to find the highest number
   - Only match branches/directories with the exact short-name pattern
   - If no existing branches/directories found with this short-name, start with number 1
   - You must only ever run this script once per feature
   - The JSON is provided in the terminal as output - always refer to it to get the actual content you're looking for
   - The JSON output will contain BRANCH_NAME, FEATURE_DIR, and SPEC_FILE paths
   - For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot")

3. Load `.specify/templates/spec-template.md` to understand required sections.

4. Follow this execution flow:

   1. Parse user description from Input
      If empty: write an explicit error to logs/output ("No feature description provided"), log the invocation context (user, timestamp, command), set a non-zero exit code, and abort the workflow immediately (throw/exit). Present a clear message asking the user to re-run the command with a description. Do NOT proceed or attempt recovery automatically.
   2. Extract key concepts from description
      Identify: actors, actions, data, constraints
   3. For unclear aspects:
       - Make informed guesses based on context and industry standards
       - Only mark with [NEEDS CLARIFICATION: specific question] if:
         - The choice significantly impacts feature scope or user experience
         - Multiple reasonable interpretations exist with different implications
         - No reasonable default exists
       - **LIMIT: Maximum 3 [NEEDS CLARIFICATION] markers total**
       - Prioritize clarifications by impact: scope > security/privacy > user experience > technical details
      4. Fill User Scenarios & Testing section
         - **Ambiguous / underspecified flows**: mark the section with `[NEEDS CLARIFICATION]`, log context (spec path, feature description), and prompt the user for details. Do not make silent assumptions.
         - **Unambiguous flows**: you MAY infer the flow using industry-standard defaults, but any inferred steps MUST be clearly flagged by prepending `ASSUMPTION:` to the step and recording the assumption in the Assumptions section.
         - **Guiding principle**: ambiguous cases are always clarified; reasonable inference is allowed only when safe.
    5. Generate Functional Requirements
       Each requirement must be testable
       Use reasonable defaults for unspecified details (document assumptions in Assumptions section)
    6. Define Success Criteria
       Create measurable, technology-agnostic outcomes
       Include both quantitative metrics (time, performance, volume) and qualitative measures (user satisfaction, task completion)
       Each criterion must be verifiable without implementation details
    7. Identify Key Entities (if data involved)
    8. Return: SUCCESS (spec ready for planning)

5. Initialize and write the specification to SPEC_FILE using the template structure:

   a. Initialize SPEC_FILE (idempotent): If `SPEC_FILE` does not exist, create it and populate it with the template structure (placeholders intact). If `SPEC_FILE` already exists, leave it unchanged. This step transitions the state from `missing` → `templated`.

   b. Write (render) SPEC_FILE (atomic overwrite): Take the template (either the newly initialized file or the existing templated file), render placeholders to concrete values derived from the feature description, and perform an atomic overwrite of `SPEC_FILE` so the final file contains the fully rendered spec. Do NOT append. This step transitions the state from `templated` → `fully rendered`.

6. **Specification Quality Validation**: After writing the initial spec, validate it against quality criteria:

   a. **Create Spec Quality Checklist**: Generate a checklist file at `FEATURE_DIR/checklists/requirements.md` using the checklist template structure with these validation items:

      ```markdown
      # Specification Quality Checklist: [FEATURE NAME]
      
      **Purpose**: Validate specification completeness and quality before proceeding to planning
      **Created**: [DATE]
      **Feature**: [Link to spec.md]
      
      ## Content Quality
      
      - [ ] No implementation details (languages, frameworks, APIs)
      - [ ] Focused on user value and business needs
      - [ ] Written for non-technical stakeholders
      - [ ] All mandatory sections completed
      
      ## Requirement Completeness
      
      - [ ] No [NEEDS CLARIFICATION] markers remain
      - [ ] Requirements are testable and unambiguous
      - [ ] Success criteria are measurable
      - [ ] Success criteria are technology-agnostic (no implementation details)
      - [ ] All acceptance scenarios are defined
      - [ ] Edge cases are identified
      - [ ] Scope is clearly bounded
      - [ ] Dependencies and assumptions identified
      
      ## Feature Readiness
      
      - [ ] All functional requirements have clear acceptance criteria
      - [ ] User scenarios cover primary flows
      - [ ] Feature meets measurable outcomes defined in Success Criteria
      - [ ] No implementation details leak into specification
      
      ## Notes
      
      - Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`
      ```

   b. **Run Validation Check**: Review the spec against each checklist item:
      - For each item, determine if it passes or fails
      - Document specific issues found (quote relevant spec sections)

   c. **Handle Validation Results**:

      - **If all items pass**: Mark checklist complete and proceed to step 7

      - **If items fail (excluding [NEEDS CLARIFICATION])**:
        1. List the failing items and specific issues
        2. Update the spec to address each issue
        3. Re-run validation until all items pass (max 3 iterations)
        4. If still failing after 3 iterations, document remaining issues in checklist notes and warn user

      - **If [NEEDS CLARIFICATION] markers remain**:
        1. Extract all [NEEDS CLARIFICATION: ...] markers from the spec
        2. **LIMIT CHECK**: If more than 3 markers exist, keep only the 3 most critical (by scope/security/UX impact) and make informed guesses for the rest
        3. For each clarification needed (max 3), present options to user in this format:

           ```markdown
           ## Question [N]: [Topic]
           
           **Context**: [Quote relevant spec section]
           
           **What we need to know**: [Specific question from NEEDS CLARIFICATION marker]
           
           **Suggested Answers**:
           
           | Option | Answer | Implications |
           |--------|--------|--------------|
           | A      | [First suggested answer] | [What this means for the feature] |
           | B      | [Second suggested answer] | [What this means for the feature] |
           | C      | [Third suggested answer] | [What this means for the feature] |
           | Custom | Provide your own answer | [Explain how to provide custom input] |
           
           **Your choice**: _[Wait for user response]_
           ```

        4. **CRITICAL - Table Formatting**: Ensure markdown tables are properly formatted to prevent renderer rejection:
           
           **Validation Rules**:
           - Each cell MUST have exactly one space before and after content: `| Content |` not `|Content|` or `|  Content  |`
           - Header separator MUST have at least 3 dashes per column: `|--------|` not `|--|`
           - All rows MUST have the same number of columns (pipes)
           - No trailing spaces after the final pipe on each line
           - Pipes SHOULD be aligned vertically for readability (though not strictly required by spec)
           
           **Correct Example**:
           ```markdown
           | Option | Answer | Implications |
           |--------|--------|--------------|
           | A      | Use OAuth2 | Requires external provider setup |
           | B      | Use JWT | Simpler but needs key management |
           | Custom | Provide your own answer | Explain how to provide custom input |
           ```
           
           **Incorrect Examples** (DO NOT USE):
           ```markdown
           |Option|Answer|Implications|          ❌ No spaces around content
           | Option | Answer | Implications|     ❌ Missing space before final pipe
           |Option | Answer | Implications |     ❌ Inconsistent spacing
           | Option | Answer |                   ❌ Missing column
           |--------|--------|-----|              ❌ Separator too short
           ```
           
           **Before finalizing**: Validate each table against these rules to ensure downstream renderers accept it
        5. Number questions sequentially (Q1, Q2, Q3 - max 3 total)
        6. Present all questions together before waiting for responses
        7. Wait for user to respond with their choices for all questions (e.g., "Q1: A, Q2: Custom - [details], Q3: B")
        8. Update the spec by replacing each [NEEDS CLARIFICATION] marker with the user's selected or provided answer
        9. Re-run validation after all clarifications are resolved

   d. **Update Checklist**: After each validation iteration, update the checklist file with current pass/fail status

7. Report completion with branch name, spec file path, checklist results, and readiness for the next phase (`/speckit.clarify` or `/speckit.plan`).

**NOTE:** The script creates and checks out the new branch and initializes the spec file before writing.

## General Guidelines


### Quick Guidelines

- Focus on **WHAT** users need and **WHY**.
- Avoid HOW to implement (no tech stack, APIs, code structure).
- Written for business stakeholders, not developers.
 - Do not embed checklists inline inside `spec.md`. Instead create external checklist files under the `checklists/` folder (for example: `FEATURE_DIR/checklists/requirements.md`). The workflow's checklist step (see Step 6a) will create/update such external files.

### Section Requirements

- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation

When creating this spec from a user prompt:

1. **Make informed guesses**: Use context, industry standards, and common patterns to fill gaps
2. **Document assumptions**: Record reasonable defaults in the Assumptions section
3. **Limit clarifications**: Maximum 3 [NEEDS CLARIFICATION] markers - use only for critical decisions that:
   - Significantly impact feature scope or user experience
   - Have multiple reasonable interpretations with different implications
   - Lack any reasonable default
4. **Prioritize clarifications**: scope > security/privacy > user experience > technical details
5. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
6. **Common areas needing clarification** (only if no reasonable default exists):
   - Feature scope and boundaries (include/exclude specific use cases)
   - User types and permissions (if multiple conflicting interpretations possible)
   - Security/compliance requirements (when legally/financially significant)


**Examples of reasonable defaults** (internal only; do NOT write these verbatim in the generated spec):

- Data retention: Assume industry-standard practices for the domain
- Performance targets: Assume standard web/mobile app expectations unless specified
- Error handling: Assume user-friendly messages with appropriate fallbacks
- Authentication method: assume industry-standard secure authentication (do not name protocols in the spec)
- Integration patterns: assume standard API integration style (describe generically, do not mandate REST or specific protocols)

Note: These are internal defaults for the Spec-Generator logic and must not be written verbatim into the produced Spec.

### Success Criteria Guidelines

Success criteria must be:

1. **Measurable**: Include specific metrics (time, percentage, count, rate)
2. **Technology-agnostic**: No mention of frameworks, languages, databases, or tools
3. **User-focused**: Describe outcomes from user/business perspective, not system internals
4. **Verifiable**: Can be tested/validated without knowing implementation details

**Good examples**:

- "Users can complete checkout in under 3 minutes"
- "System supports 10,000 concurrent users"
- "95% of searches return results in under 1 second"
- "Task completion rate improves by 40%"

**Bad examples** (implementation-focused):

- "API response time is under 200ms" (too technical, use "Users see results instantly")
- "Database can handle 1000 TPS" (implementation detail, use user-facing metric)
- "React components render efficiently" (framework-specific)
- "Redis cache hit rate above 80%" (technology-specific)
