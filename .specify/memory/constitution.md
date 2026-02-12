<!--
  Sync Impact Report
  ===================
  Version change: 2.1.0 → 2.2.0
  Modified principles: N/A
  Added sections:
    - IX. Aither Control API — external apps can control the HTML player via API
  Removed sections: N/A
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ compatible (Constitution Check generic)
    - .specify/templates/spec-template.md ✅ compatible (no constitution refs)
    - .specify/templates/tasks-template.md ✅ compatible (phase structure flexible)
    - .specify/templates/checklist-template.md ✅ compatible (generic)
    - .specify/templates/agent-file-template.md ✅ compatible (generic)
  Follow-up TODOs:
    - Update specs/001-hemera-api-integration: remove all Prisma/database assumptions
    - Update specs/001-hemera-api-integration/plan.md: remove Prisma from tech stack
-->

# Aither Constitution

## Core Principles

### I. Test-First Development (NON-NEGOTIABLE)

Test-Driven Development is mandatory for all features and components:

- **Contract Tests First**: All new features MUST start with failing contract
  tests that define expected behavior.
- **Unit Tests Required**: Every component, utility, and service MUST have
  comprehensive unit tests.
- **TDD Cycle**: Red (failing tests) → Green (minimal implementation) →
  Refactor → Repeat.
- **Test Coverage**: Minimum 80 % code coverage for critical paths; 90 % for
  authentication and payment flows.
- **Payment Testing**: All Stripe integration MUST use test mode for
  development with mock payment scenarios.
- **Formatting Tests**: Code formatting tests MUST ensure consistent style
  across the entire codebase.

**Rationale**: Catching defects at the contract/test level is orders of
magnitude cheaper than fixing them in production. A strict TDD discipline
guarantees every line of code is exercised before it ships.

### II. Code Quality & Formatting

Consistent code quality and formatting standards are enforced:

- **Biome Integration**: All code MUST pass Biome formatting and linting
  checks before commit. Biome is the sole tool for both formatting and
  linting — no other formatters or linters are permitted.
- **Pre-commit Hooks**: Automated Biome formatting and linting on every
  commit via Husky.
- **CI/CD Gates**: GitHub Actions workflows MUST block merges for formatting
  violations.
- **TypeScript Strict Mode**: Full type safety with strict TypeScript
  configuration is required.

**Rationale**: Machine-enforced style eliminates bikeshedding and ensures
diffs contain only meaningful changes.

### III. Feature Development Workflow

Every feature follows a structured development process:

- **Specification First**: Features MUST start with detailed specifications
  in the `specs/` directory.
- **Contract Definition**: API contracts and component interfaces MUST be
  defined before implementation begins.
- **Error Monitoring Integration**: Rollbar error tracking MUST be configured
  for development and production environments.

**Rationale**: Upfront specification reduces rework; contract-first design
ensures stable interfaces between components.

### IV. Authentication & Security

Security-first approach to user authentication, payment processing, data
protection, and error monitoring:

- **Rollbar Monitoring**: Comprehensive error tracking with client-side and
  server-side monitoring is required.
- **Error Reporting Security**: Rollbar integration MUST include proper data
  filtering and access token management.
- **CVE Monitoring**: Regular dependency vulnerability scanning and updates
  are mandatory.
- **Server-Authoritative Pricing**: Never trust client-provided prices,
  currency, or discounts — server is authoritative only.
- **Sensitive Data Exclusion**: PII, tokens, and sensitive data MUST be
  excluded from logs and events.

**Rationale**: Security is a foundational concern; breaches are catastrophic
and irreversible. Defence-in-depth protects users and reputation.

### V. Component Architecture

Modular, reusable component design principles:

- **Material-UI Integration**: All UI components MUST follow the Material-UI
  design system.
- **Theme Consistency**: Centralized theme management for dark/light mode
  support is required.
- **Component Testing**: Each UI component MUST have dedicated unit tests for
  behavior and rendering.
- **Accessibility Standards**: WCAG 2.1 AA compliance is mandatory for all
  interactive elements.
- **Performance Optimization**: Lazy loading, code splitting, and bundle
  optimization MUST be applied.

**Rationale**: A consistent component model accelerates development, reduces
cognitive load, and delivers predictable UX.

### VII. Stateless Architecture (NON-NEGOTIABLE)

Aither operates without a local database. All data flows through the
application without persistent local storage:

- **No Local Database**: Aither MUST NOT use a local database (no Prisma,
  no PostgreSQL, no SQLite, no other database). Data MUST NOT be replicated
  into local storage.
- **Fetch → Transform → Output**: Aither fetches selective data from the
  Hemera API, transforms it, and generates HTML files containing the data.
  This is the only read-direction data flow.
- **Direct API Pass-Through**: When Aither generates data (e.g., MUX
  recording URLs), it MUST transmit the data directly to the Hemera API.
  Generated data MUST NOT be stored locally before transmission.
- **HTML as Output Artifact**: The primary output of Aither is generated
  HTML files. These files represent the transformed academy content and are
  served directly to users.
- **Transient State Only**: Any in-memory state (e.g., sync job progress)
  is transient and may be lost on restart. This is acceptable.

**Rationale**: A stateless architecture eliminates database maintenance,
migration complexity, and data consistency concerns. Aither is a
transformation layer, not a data store. The Hemera API is the single
source of truth.

### VIII. HTML Playback & Video Recording

Aither generates HTML content and records video from external cameras:

- **Full-Screen HTML Player**: Aither MUST render generated HTML files in a
  full-screen HTML player. The player is the primary presentation mode for
  academy content (seminars, lessons).
- **External Camera Recording**: Aither MUST capture video from external
  cameras (e.g., USB, IP cameras) connected to the host machine.
- **Direct MUX Upload**: Recorded video files MUST be uploaded directly to
  MUX (video hosting platform). Video files MUST NOT be stored permanently
  on the local filesystem — they are streamed or temporarily buffered
  during upload only.
- **MUX as Video Store**: MUX is the single source of truth for all video
  recordings. Aither only holds transient references (MUX asset IDs,
  playback URLs) during the recording and upload process.
- **Recording → API Transmission**: After a successful MUX upload, the
  resulting MUX playback URL MUST be transmitted directly to the Hemera
  API (consistent with Principle VII — no local persistence).

**Rationale**: Aither is both a content presentation system (HTML player)
and a video capture system (camera → MUX). Keeping video storage on MUX
avoids local disk capacity issues and provides CDN-backed video delivery.

### IX. Aither Control API

Aither exposes its own API that allows external applications to control
the HTML player and other Aither functions:

- **Player Control Endpoints**: The API MUST expose endpoints to control
  the full-screen HTML player (e.g., load content, start/stop playback,
  navigate between slides/lessons).
- **External App Integration**: External applications MUST be able to
  orchestrate Aither’s HTML player remotely through the API, enabling
  use cases such as automated presentation flows or instructor-controlled
  playback.
- **API Authentication**: All control API endpoints MUST require
  authentication (API key or Clerk token) to prevent unauthorized access.
- **Stateless Control**: API commands control the player state in real-time.
  Player state is transient and not persisted (consistent with
  Principle VII).
- **Contract-First Design**: The Aither Control API MUST be defined with
  an OpenAPI contract before implementation (consistent with
  Principle III).

**Rationale**: Exposing a control API decouples the presentation logic
from external orchestration systems. This enables flexible integration
with instructor tools, automation systems, or companion apps without
modifying Aither’s core codebase.

### VI. Holistic Error Handling & Observability

Comprehensive error management across the entire application lifecycle with
proactive monitoring, graceful degradation, and user-centric recovery:

#### Error Prevention & Detection

- **Rollbar Integration**: Mandatory error tracking for all production
  applications using official Next.js patterns.
- **Mandatory Rollbar Error Logging**: All error logging MUST use Rollbar
  instead of `console.error`.
  - Use `serverInstance.error()` from `@/lib/monitoring/rollbar-official` for
    all server-side errors.
  - Include structured context data (userId, requestId, timestamp, error
    details).
  - Replace all `console.error` statements with appropriate Rollbar logging
    calls.
  - Maintain error severity levels (critical, error, warning, info, debug).
- **Client-Side Monitoring**: React Error Boundaries with `useRollbar` hooks
  MUST capture component errors.
- **Server-Side Tracking**: All API routes, middleware, and server functions
  MUST report to Rollbar.
- **Global Error Handlers**: App Router `error.tsx` and `global-error.tsx`
  MUST provide comprehensive coverage.
- **Instrumentation**: Next.js `instrumentation.ts` for uncaught exceptions
  and unhandled rejections is required.
- **Performance Monitoring**: Critical user flows, Core Web Vitals, and
  performance bottlenecks MUST be tracked.
- **TypeScript Guards**: Strict type checking prevents runtime errors at
  compile time.
- **Validation Layers**: Zod schemas for API input/output validation with
  detailed error messages are required.

#### Error Classification & Response

- **Severity Levels**: Critical (system down), Error (feature broken),
  Warning (degraded), Info (tracking).
- **Error Categories**: Authentication, Payment, Network,
  Validation, Security, Performance.
- **User-Facing Errors**: Meaningful error messages with actionable recovery
  steps are required.
- **Silent Monitoring**: Background errors MUST be logged without disrupting
  user experience.
- **Cascade Prevention**: Circuit breakers MUST prevent error propagation
  across services.
- **Graceful Degradation**: Fallback mechanisms MUST activate when external
  services are unavailable.

#### Recovery & User Experience

- **Error Boundaries**: Isolate component failures with recovery options
  (retry, refresh, fallback UI).
- **Progressive Enhancement**: Core functionality MUST work even when
  advanced features fail.
- **Offline Resilience**: Service workers MUST cache critical assets and
  provide offline experiences.
- **User Feedback Loops**: Error reporting mechanisms with user context and
  reproduction steps are required.
- **Auto-Recovery**: Automatic retry mechanisms for transient failures
  (network, rate limits) MUST be implemented.
- **Maintenance Mode**: Graceful handling of planned downtime with
  informative messaging is required.

#### Monitoring & Alerting

- **Real-Time Alerts**: Immediate notifications for critical errors affecting
  user experience.
- **Trend Analysis**: Error rate monitoring and anomaly detection across time
  periods.
- **Environment Separation**: Isolated Rollbar projects for development,
  staging, and production.
- **Dashboard Visibility**: Error metrics integrated into development and
  operations dashboards.
- **Escalation Procedures**: Automated escalation paths based on error
  severity and impact.
- **Post-Incident Reviews**: Structured analysis of major incidents with
  prevention planning.

#### Privacy & Security

- **Data Privacy**: PII, tokens, and sensitive data MUST be filtered from all
  error reports.
- **Security Incident Tracking**: Enhanced monitoring for authentication
  failures and breaches is required.
- **Audit Trails**: Comprehensive logging of security-related events and
  error responses.
- **Access Controls**: Restricted access to error monitoring data based on
  team roles.
- **Compliance**: Error handling MUST be aligned with GDPR, CCPA, and
  industry security standards.

#### Development Integration

- **CI/CD Validation**: Error monitoring functionality MUST be tested in all
  deployment pipelines.
- **Development Tools**: Local error simulation and testing capabilities are
  required.
- **Documentation**: Runbooks for common error scenarios and resolution
  procedures MUST exist.
- **Team Training**: Regular education on error handling best practices and
  incident response.
- **Metrics Integration**: Error rates MUST be included in definition of done
  for all features.

**Rationale**: Users experience errors — not code. A holistic approach
ensures errors are prevented where possible, detected instantly, and
recovered from gracefully.

## Development Standards

### Testing Requirements

- **Unit Tests**: Located in `tests/unit/` with `.spec.ts` extension.
- **E2E Tests**: Playwright tests in `tests/e2e/` covering critical user
  journeys.
- **Contract Tests**: API and component contract validation before
  implementation.
- **Biome Tests**: Automated formatting and linting validation with
  `npm run test:biome`.
- **Performance Tests**: Load testing for authentication and course
  enrollment flows.
- **Payment Integration Tests**: Stripe webhook testing and checkout flow
  validation.
- **Error Handling Tests**: Comprehensive error scenario testing including
  boundary conditions, recovery flows, and graceful degradation.
- **Error Monitoring Tests**: Rollbar integration testing for error capture,
  classification, and reporting across all error types.
- **Security Tests**: Vulnerability scanning and penetration testing for
  auth flows.

### Code Organization

- **Feature Folders**: Group related components, tests, and utilities by
  feature.
- **Shared Libraries**: Common utilities in `lib/` directory with proper
  TypeScript exports.
- **API Routes**: Next.js API routes with proper error handling and
  validation.
- **Payment Processing**: Stripe integration with secure webhook endpoints
  and proper error handling.
- **Holistic Error Handling**: Comprehensive error management with
  prevention, detection, graceful recovery, and user-centric error
  experiences.
- **Component Structure**: Separate presentational and container components.

### Quality Gates

All code changes MUST pass these gates before merge:

- **Type Checking**: TypeScript compilation without errors.
- **Unit Test Coverage**: Minimum 80 % coverage for new code.
- **E2E Test Suite**: Critical path tests MUST pass.
- **Build Verification**: `npm run build` MUST complete successfully.

## Deployment Requirements

### Linux Service Operation

The application runs as a service on a Linux machine. The source code
repository is hosted on GitHub.

- **Linux Service**: The application runs as a systemd service (or
  equivalent) on a Linux machine. It is started with `npm run build &&
  npm start` for production and `npm run dev` for development.
- **Self-Hosted**: The application is NOT deployed to any cloud hosting
  platform. It runs on a dedicated or virtual Linux machine.
- **GitHub as Source of Truth**: The Git repository is hosted on GitHub for
  version control, collaboration, and CI/CD quality gates.

### CI/CD Pipeline Standards

GitHub Actions is used exclusively for quality gate enforcement (NOT for
deployment):

- **Quality Gates First**: No code merges without passing all quality checks.
- **Production Build Verification**: `npm run build` MUST complete
  successfully in CI.
- **Rollback Capability**: Git revert is the rollback strategy for broken
  changes on `main`.

### GitHub Actions Workflow Requirements

The GitHub Actions workflow enforces quality standards:

- **Sole Quality Gate Authority**: GitHub Actions is the only authorized
  method for enforcing quality gates on pull requests.
- **Multi-Stage Pipeline**: Separate jobs for type checking, linting,
  formatting, unit tests, and build verification.
- **Dependency Chain**: Merges to `main` only occur after all quality gates
  pass in automated sequence.
- **Artifact Management**: Playwright reports uploaded for debugging failed
  E2E tests via workflow artifacts.
- **Payment Security**: Stripe webhook secrets and API keys secured in
  repository secrets with proper test/live separation and
  workflow-restricted access.

### Compliance

- **Self-Hosted Only**: The application runs as a service on a Linux
  machine. There are no cloud deployment targets.
- **Environment Variables**: Sensitive configuration managed through `.env`
  files on the Linux host (excluded from version control via `.gitignore`)
  and GitHub secrets for CI workflows.
- **Audit Trail**: All code changes are traceable through Git history and
  GitHub Actions logs with proper commit SHA tracking.

## Technology Stack Requirements

### Core Technologies

- **Frontend**: Next.js 16+ with App Router, React 18+, TypeScript 5+.
- **Styling**: Material-UI (MUI) with custom theme support.
- **Testing**: Playwright for E2E, Jest/Vitest for unit tests.
- **Error Monitoring**: Rollbar for comprehensive error tracking and
  performance monitoring.
- **AI Research Assistant**: Perplexity MCP server and Context7 for enhanced
  research and documentation.
- **Code Quality**: Biome (formatting + linting), Husky for pre-commit
  hooks.
- **Video Platform**: MUX for video recording storage, processing, and
  CDN-backed playback.

### Development Tools

- **Package Manager**: npm with `package-lock.json` for reproducible builds.
- **Version Control**: Git with conventional commit messages.
- **CI/CD**: GitHub Actions for automated quality gate enforcement.
- **Code Editor**: VS Code with recommended Biome extension.

### Runtime Environment

- **Linux Service**: The application runs as a service on a Linux machine
  in production and locally during development.
- **GitHub Repository**: Source code hosted on GitHub for version control
  and collaboration.
- **Quality Gates**: Every pull request MUST pass TypeScript compilation,
  Biome formatting and linting, unit tests, and build verification
  through GitHub Actions.

## Governance

### Constitution Enforcement

This constitution supersedes all other development practices and MUST be
followed strictly:

- **PR Reviews**: All pull requests MUST verify constitutional compliance.
- **Quality Gates**: Automated checks enforce formatting, testing, and build
  requirements through GitHub Actions exclusively.
- **Exception Process**: Any deviation requires explicit justification and
  team approval.
- **Regular Audits**: Monthly reviews of compliance and process effectiveness.

### Amendment Process

- **Documentation Required**: All changes MUST be documented with clear
  rationale.
- **Team Approval**: Constitutional changes require unanimous team agreement.
- **Migration Plan**: Breaking changes need detailed migration and rollback
  strategies.
- **Version Control**: All amendments are tracked with semantic versioning
  (MAJOR for principle removals/redefinitions, MINOR for additions/
  expansions, PATCH for clarifications/wording).

### Testing Compliance

- **Unit Test Mandate**: No feature implementation without corresponding unit
  tests.
- **Contract Validation**: API and component contracts MUST be tested before
  implementation.
- **Error Handling Validation**: All error scenarios MUST have tested recovery
  paths and graceful degradation.
- **Error Monitoring Validation**: Rollbar error tracking MUST be tested for
  prevention, detection, classification, and recovery workflows.
- **Performance Benchmarks**: Authentication flows MUST meet sub-100 ms
  response requirements.

**Version**: 2.2.0 | **Ratified**: 2026-02-10 | **Last Amended**: 2026-02-11
