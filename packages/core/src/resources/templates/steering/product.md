# Product Requirements Document (PRD): Agentic Node.js Microservice Skeleton

When product vision is not specified, use these opinionated defaults.
**User-defined values ALWAYS override these defaults.**

## 1. Project Overview

**Name**: Agentic Node.js Microservice Skeleton

**Goal**: Provide a minimalist, highly performant, and *hallucination‑resistant* foundation
for building microservices using Agentic Coding tools (GitHub Copilot, Cursor, etc.).

**See also**: [architecture.md](.spec/steering/architecture.md) for system structure and diagrams.

### Philosophy

**Context Reduction**
- Remove implicit magic that confuses smaller LLMs (decorators, DI containers, hidden wiring).
- Make all flows explicit, readable, and local to a file/folder.

**Standard over Library**
- Prefer native Node.js APIs and stable standards (JSON‑RPC 2.0) over volatile libraries.
- Avoid frameworks that introduce hidden middleware, magic routing, or reflection.

**Vertical Slices**
- Organize by feature (module) rather than technical layer.
- Allow agents to reason about one folder at a time.

## 2. Product Goals

### 2.1 LLM-Friendly Codebase
- Explicit imports/exports and deterministic control flow
- Predictable file structure and naming
- No magic string method discovery

### 2.2 Zero-Magic Runtime
- No decorators or auto‑wiring
- No implicit dependency injection
- No runtime reflection

### 2.3 Transport Agnostic Protocol
- Core business logic callable without HTTP
- JSON‑RPC payloads for uniform handling

### 2.4 Progressive Complexity
- Start simple; add abstractions only when required

## 3. Non‑Goals

| Non‑Goal | Reason |
|----------|--------|
| Framework lock‑in | Express/Fastify/NestJS hide control flow |
| Class‑heavy architecture | Pure functions are easier for agents |
| Mock‑first testing | Real services surface real bugs |
| Unit test obsession | Integration tests are more valuable |
| 100% coverage | Meaningful coverage over vanity metrics |

## 4. Target Users

### Primary: AI Coding Agents
- Predictable patterns
- Explicit boundaries
- Minimal context switching

### Secondary: Senior Developers
- Easy to understand and modify
- Low maintenance cost

### Tertiary: DevOps Engineers
- Few moving parts
- Clear deployment boundaries

## 5. Success Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Agent success rate | >90% | AI‑generated code works first try |
| Code predictability | High | Behavior is obvious from code |
| Test reliability | 100% | Tests deterministic and stable |
| Onboarding speed | < 1 hour | New devs productive quickly |

## 6. Architecture (High‑Level)

- Architecture is defined in [architecture.md](.spec/steering/architecture.md).
- Product-level focus: keep runtime simple, transport-agnostic, and LLM-friendly.

## 7. Functional Requirements (Skeleton MVP)

### 7.1 Module: Health
- Method: `health.check`
- Returns: `{ status: "ok", timestamp: "..." }`
- No database interaction

### 7.2 Module: User (CRUD Example)
- Method: `user.create` (Params: `{ email, name }`)
- Method: `user.list` (Params: `{ limit? }`)
- Validates email via Zod
- Persists via Prisma (SQLite default)

## 8. Configuration & Environment

**File**: `.env.example`

```
DATABASE_URL="file:./dev.db"
PORT=3000
NODE_ENV="development"
```

**Loading**: Use `process.loadEnvFile()` (Node v21.7+)
