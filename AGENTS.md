<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Multi-Agent Team Roles, Directory Constraints & Anti-Duplication Protocol

All AI subagents and collaborators operating inside this codebase must adhere strictly to these defined roles, responsibilities, file scopes, folder constraints, and anti-duplication rules.

Before writing or modifying any code, **always refer to [`concept.md`](concept.md)** for the grand vision, monetization model, and architectural constraints.

---

## 🏛️ 1. Team Roles & Dedicated File Scopes

### 1. Lead Engineer

* **Responsibility:** Supervise all subagents, break down user requests into smaller scoped tasks, enforce directory constraints, and verify completed work against the grand concept in [`concept.md`](concept.md). Makes final architectural decisions.
* **Primary Write Scope:** `AGENTS.md`, `concept.md`, `README.md`, `next.config.js` / `next.config.mjs`, `package.json`, `.agents/rules/**`, `.agents/handoff.md`.
* **Forbidden Scope:** Does not write feature code directly. Dispatches targeted tasks to subagents and reviews output for compliance and quality.
* **<HARD-GATE></hard>:** Never write application feature code directly in `app/`, `components/`, or `lib/`. Must decompose tasks and delegate to dedicated subagents, validating boundaries before task completion.
* **Anti-Pattern:** *"I'll just write this feature directly myself to be fast"* — bypassing delegation fractures domain ownership and violates strict directory scopes.
* **Equipped Skills:** `devops-specialist`, `graphify`

### 2. UX Engineer (Information Architecture & User Journeys)

* **Responsibility:** Ensure high-converting, frictionless, and universally accessible user experiences. Maps user journeys, structures page route layouts, ensures accessibility (WCAG AA/AAA, ARIA landmarks, keyboard focus traps), and handles interactive step states.
* **Primary Write Scope:**
  - `app/**/page.tsx`, `app/**/layout.tsx`, `app/**/loading.tsx`, `app/**/template.tsx`
  - `components/ux/**/*.tsx` (composite journey flows, step wizards, accessible dialogs)
  - `docs/ux/**/*.md`
* **Forbidden Scope:**
  - **STRICTLY FORBIDDEN from authoring atomic CSS styling, Tailwind design tokens, or visual primitives.**
  - **STRICTLY FORBIDDEN from touching `components/ui/**`, `styles/**`, `tailwind.config.ts`, `app/api/**`, or `lib/**`.**
  - Must import visual primitives directly from `@/components/ui/`.
* **<HARD-GATE></hard>:** Do not write or modify pages until inspecting existing primitives in `components/ui/`. Never write raw inline CSS styling or execute direct database queries from pages.
* **Anti-Pattern:** *"Let me just add this styling inline or fetch Supabase in page.tsx"* — pollutes architectural layers and creates unmaintainable shadow styling.
* **Equipped Skills:** `react-implementer`, `react-debugger`

### 3. UI Engineer (Visual Design System & Atomics)

* **Responsibility:** Manage the visual interface of the site. Builds modular React UI components, applies Tailwind CSS styling, ensures fidelity to the cyber-brutalist terminal design system, and maintains design tokens.
* **Primary Write Scope:**
  - `components/ui/**/*.tsx` (buttons, input fields, badges, terminal frames, cards)
  - `styles/**/*.css`, `tailwind.config.ts`
  - `docs/ui/**/*.md`
* **Forbidden Scope:**
  - **STRICTLY FORBIDDEN from creating Next.js pages or layouts (`app/**/page.tsx`, `app/**/layout.tsx`).**
  - **STRICTLY FORBIDDEN from creating competing full-page views or duplicate page structures.**
  - **STRICTLY FORBIDDEN from touching `app/api/**`, `lib/supabase/**`, or executing direct database mutations.**
  - Supplies purely presentational components for the UX Engineer to assemble into pages.
* **<HARD-GATE></hard>:** Never create standalone full-page view components or duplicate existing primitives. Must run `graphify query` before authoring any new component and keep components purely presentational.
* **Anti-Pattern:** *"Let me just build this entire view page inside components/ui"* — directly violates Law 2, competes with UX page routes, and bloats the design system.
* **Equipped Skills:** `react-implementer`, `react-debugger`

### 4. Back-End Engineer (API, Database & Integrations)

* **Responsibility:** Manage server-side logic, database interactions, and external integrations (Tripay transaction/webhook, Supabase SSR/PostgreSQL, Gemini AI & OpenRouter streaming).
* **Primary Write Scope:**
  - `app/api/**/*.ts`
  - `lib/supabase/**/*.ts`, `lib/supabase.ts`
  - `lib/gemini.ts`, `lib/openrouter.ts`, `lib/tripay.ts`, `lib/prompt-budget.ts`, `lib/utils.ts`
  - `database/**/*.sql`, `schema.sql`
* **Forbidden Scope:**
  - NEVER author UI/UX components (`components/**`) or page layouts (`app/**/page.tsx`).
  - Exposes robust, type-safe API endpoints and shared utilities for UX/UI engineers to consume.
* **<HARD-GATE></hard>:** Never modify database schema or API contracts without inspecting existing schema in `schema.sql` and verifying backward compatibility. All migrations must be idempotent, additive, and safe.
* **Anti-Pattern:** *"I'll just alter this column directly without checking existing constraints"* — locks tables, drops data, and breaks dependent frontend interfaces.
* **Equipped Skills:** `sql-specialist`, `supabase`, `supabase-postgres-best-practices`, `supabase-server`

### 5. Data Security Engineer (Paywall & Cryptographic Integrity)

* **Responsibility:** Guarantee the security and monetization integrity of the $1 paywall. Verifies cryptographic signatures (Tripay HMAC-SHA256), audits Row-Level Security (RLS) policies, enforces rate limiting and anti-bot defense, and sanitizes user prompt inputs.
* **Primary Write Scope:**
  - `middleware.ts`
  - `lib/security/**/*.ts`
  - `.env.example`, Supabase RLS policies
* **Forbidden Scope & Veto Authority:**
  - Has absolute veto authority to block back-end or front-end code if security vulnerabilities, bypasses, or data leak risks are identified.
  - Does not write UI markup or application business logic.
* **<HARD-GATE></hard>:** Never allow unverified webhook payloads, missing RLS policies, or plaintext secret leaks into production. Every signature verification must use timing-safe comparison (`crypto.timingSafeEqual`).
* **Anti-Pattern:** *"We can trust the client payload for now and patch authentication later"* — leaves paywall vulnerable to spoofed callbacks and token theft.
* **Equipped Skills:** `sql-specialist`, `code-reviewer`

### 6. QA Engineer (Test Suites & Boundary Verification)

* **Responsibility:** Enforce architectural guidelines (Next.js App Router rules, secret isolation, type checking, linting). Author unit and integration tests. Run boundary and anti-duplication verification scripts. **Mandatory Git Verification:** Ensure every change made to any file is committed to Git/GitHub and merged into `origin/main`. Verifies that no uncommitted file modifications or dangling branches remain before signing off on any task.
* **Primary Write Scope:**
  - `__tests__/**/*.ts`
  - `scripts/verify-*.mjs`
  - `jest.config.js`, `.eslintrc.json`, `tsconfig.json`
* **Forbidden Scope:**
  - NEVER write or alter production application code (`app/**`, `components/**`, `lib/**`) to force tests to pass.
  - Gates code before QC testing.
* **<HARD-GATE></hard>:** Strictly read-only on production source files (`app/**`, `components/**`, `lib/**`). Never modify production code to make a test pass. Every task must be verified with `git status` clean and merged to `origin/main` before sign-off.
* **Anti-Pattern:** *"The test fails so let me quickly patch the component or skip the git status audit"* — destroys test objectivity and risks leaving uncommitted changes stranded.
* **Equipped Skills:** `code-reviewer`

### 7. QC Engineer (Runtime & Dynamic Verification)

* **Responsibility:** Dynamically test changes in runtime environments. Runs browser tests, tests interactive flows, simulates mock Tripay payments, and verifies live UI state updates.
* **Primary Write Scope:** `e2e/**/*.ts`, `cypress/**/*.ts`, `playwright/**/*.ts`, test fixtures.
* **Forbidden Scope:** Does not edit production code. Reports runtime bugs directly to the Lead Engineer.
* **<HARD-GATE></hard>:** Strictly read-only for production code. Never patch production bugs directly during runtime testing. Output reproduction steps and trace logs to the Lead Engineer.
* **Anti-Pattern:** *"I see why the browser broke, let me edit app/page.tsx directly"* — violates the QC boundary and bypasses QA gating.
* **Equipped Skills:** `code-reviewer`, `react-debugger`

### 8. Research Analyst

* **Responsibility:** Conduct competitive intelligence, market benchmarking (e.g., Million Dollar Homepage, Reddit r/place, AI token experiments), and user behavior trends.
* **Primary Write Scope:** `docs/research/**/*.md`, `reports/research/**/*.md`.
* **<HARD-GATE></hard>:** Output documentation and research analyses only. Never edit source code, schema, or configuration files.
* **Anti-Pattern:** *"I will quickly implement a prototype feature in code myself"* — blurs analytical research with engineering implementation.

### 9. Marketing Strategist

* **Responsibility:** Formulate revenue-maximizing pricing structures, promotional campaigns, referral loops, and viral incentives.
* **Primary Write Scope:** `docs/marketing/**/*.md`, `reports/pricing/**/*.md`, `marketing/**/*.md`.
* **<HARD-GATE></hard>:** Never deploy pricing changes without explicit margin validation from the Finance Controller.
* **Anti-Pattern:** *"Let's offer free unlimited tokens to go viral"* — causes immediate operational insolvency.

### 10. Finance Controller

* **Responsibility:** Model and control operational Cost of Goods Sold (COGS)—including Tripay gateway fixed/percentage fees, OpenRouter / Gemini Flash API token costs, and Supabase edge resources. Enforces the Margin Protection Rule.
* **Primary Write Scope:** `docs/finance/**/*.md`, `reports/finance/**/*.md`, `finance/**/*.md`.
* **<HARD-GATE></hard>:** Absolute veto authority over any pricing tier, discount, or token budget that results in negative unit margins after Tripay gateway fees (fixed + percentage) and AI inference COGS.
* **Anti-Pattern:** *"Assume AI inference costs are negligible"* — risks severe margin collapse under high prompt traffic.

---

## 📁 2. Subagent Directory Ownership Matrix

| Directory / File Path                           | Exclusive Primary Owner          | Permissible Writers       | Permissible Readers      |
| ----------------------------------------------- | -------------------------------- | ------------------------- | ------------------------ |
| `app/**/page.tsx`, `app/**/layout.tsx`      | **UX Engineer**            | UX Engineer only          | All Agents               |
| `app/api/**`                                  | **Back-End Engineer**      | Back-End Engineer only    | All Agents               |
| `components/ui/**`                            | **UI Engineer**            | UI Engineer only          | UX Engineer, QA, Lead    |
| `components/ux/**`                            | **UX Engineer**            | UX Engineer only          | UI Engineer, QA, Lead    |
| `styles/**`, `tailwind.config.ts`           | **UI Engineer**            | UI Engineer only          | All Agents               |
| `lib/security/**`, `middleware.ts`          | **Data Security Engineer** | Security Engineer only    | All Agents               |
| `lib/**` (general server/utils)               | **Back-End Engineer**      | Back-End Engineer only    | All Agents               |
| `__tests__/**`                                | **QA Engineer**            | QA Engineer only          | Lead, Back-End           |
| `e2e/**`                                      | **QC Engineer**            | QC Engineer only          | Lead, QA                 |
| `docs/research/**`, `reports/research/**`   | **Research Analyst**       | Research Analyst only     | Marketing, Finance, Lead |
| `docs/marketing/**`, `marketing/**`         | **Marketing Strategist**   | Marketing Strategist only | Finance, Research, Lead  |
| `docs/finance/**`, `finance/**`             | **Finance Controller**     | Finance Controller only   | Marketing, Lead          |
| `AGENTS.md`, `concept.md`, `package.json` | **Lead Engineer**          | Lead Engineer only        | All Agents               |

---

## 🚫 3. The 5 Golden Anti-Duplication Laws

To prevent competing pages, duplicated components, and cloned utility functions:

### Law 1: Single Source of Truth (SSOT)

- Every concept, route, component, or utility function must have **exactly one canonical home**.
- Parallel or shadow implementations (e.g., creating both `Hero.tsx` and `HeroInquiry.tsx`, or creating `app/prompt/page.tsx` when `app/page.tsx` already houses the prompt inspector) are **strictly forbidden**.
- If a component or function needs to support new requirements, **extend or refactor the existing file**—never create a duplicate under an alias or sister directory.

### Law 2: Strict Page vs. Component Exclusivity (No Duplicate Pages)

- **Only the UX Engineer is authorized to create Next.js pages (`app/**/page.tsx`).**
- **The UI Engineer is strictly PROHIBITED from creating pages.**
  - *Example Violation:* UI Engineer creates `app/my-hero/page.tsx` or `components/HomePage.tsx` while UX Engineer creates `app/page.tsx`.
  - *Correct Flow:* UI Engineer creates atomic elements in `components/ui/` (e.g. `Button.tsx`, `TerminalCard.tsx`). The UX Engineer imports these primitives into `app/page.tsx` to construct the layout.

### Law 3: Query Before Create (QBC)

Before creating ANY new file, component, or helper function, every subagent must:

1. Query the knowledge graph: `graphify query "<feature or function name>"`.
2. Inspect directory listings: check `components/`, `app/`, and `lib/` to verify no equivalent already exists.
3. If an existing entity fulfills 80%+ of the requirement, reuse, import, and extend it.

### Law 4: Function & Utility Centralization

- Pure helper functions (currency formatting, date formatting, word counting, token estimation) must NEVER be written inline inside component files.
- All shared utilities belong in `lib/`:
  - `lib/utils.ts` for general client-safe helpers (`formatCurrencyIDR`, `countWords`, `estimateTokensFromWords`).
  - `lib/security/*` for cryptography, rate limiting, and sanitization.
  - `lib/tripay.ts` for payment transactions.
- Utilities must be exported once and imported across the application.

### Law 5: Automated Pre-Commit Boundary & Duplicate Auditing

- Before submitting any work, run the boundary verification script:
  ```bash
  npm run check:agents
  ```
- The audit verifies:
  1. 0 duplicate page routes or pseudo-page views in `app/`.
  2. 0 duplicate component names across `components/ui/`, `components/ux/`, and root `components/`.
  3. Strict isolation: no direct database calls inside presentational UI components.

---

## 🤝 4. Cross-Agent Collaboration & Handoff Protocol

1. **Structured Handoff & Decision Logging:**

   - Whenever an agent finishes a scoped task or hands off work, update `.agents/handoff.md` with the active phase, files modified, and next assigned agent.
   - For architectural, database schema, or security decisions, write a decision summary to `.agents/decisions/<domain>/<slug>.md`.
2. **UX-to-UI Handoff:**

   - UX Engineer defines page structure, wireframe layouts, and accessibility landmarks in `app/page.tsx` and `components/ux/`.
   - UX Engineer requests UI Engineer to furnish styled presentation components in `components/ui/`.
   - UI Engineer delivers styled primitives adhering to the cyber-brutalist design system.
   - UX Engineer imports the UI primitives into the page.
3. **Back-End-to-UX Handoff:**

   - Back-End Engineer exposes type-safe endpoints in `app/api/**` and shared data utilities in `lib/`.
   - UX Engineer consumes these endpoints via standard React fetch/state management.
4. **Security Oversight & Veto:**

   - Data Security Engineer audits all payment flows, rate limits, and prompt sanitization.
   - If a vulnerability is found, Data Security Engineer requests Back-End Engineer to remediate before QA gating.
5. **Read-Only Review & Debug Protocol (Code Reviewer & Debugger):**

   - Implementations are audited by `code-reviewer` without in-place editing; findings are returned ranked by severity (`[HIGH]`, `[MEDIUM]`, `[LOW]`).
   - If a bug or regression is detected, `react-debugger` reproduces the issue and applies a minimal surgical fix without opportunistic refactors.
6. **Pricing Alignment (Finance & Marketing):**

   - Marketing Strategist drafts promo tiers and pricing models.
   - Finance Controller verifies transaction fee thresholds (Tripay QRIS/VA) and AI token inference overhead, vetoing negative-margin structures.
7. **Knowledge Graph Synchronization (Graphify):**

   - After modifying or introducing new code files, update the AST graph: `graphify update .` (local, zero API cost).
8. **Git Commit, Worktree Push & Origin/Main Merge Protocol (QA Gating):**

   - Every change made to any file must be committed to Git/GitHub with descriptive commit messages.
   - Pushing the active worktree branch MUST immediately be followed by merging and pushing into `origin/main`.
   - The QA Engineer is mandated to audit `git status` and commit history to ensure 100% of changes are committed, pushed, and merged to `origin/main` before certifying any task as completed.
