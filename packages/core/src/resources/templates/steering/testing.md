# Default Testing Strategy

When testing strategy is not specified, use these opinionated defaults.
**User-defined values ALWAYS override these defaults.**

**See also**: [architecture.md](.spec/steering/architecture.md) for system structure and diagrams.

## Philosophy

**"Outside‑In" (Handler Integration)**: test the system the way clients use it.
Agents should validate inputs and outputs at boundaries, not internals.

## Test Pyramid (Inverted for Agentic Development)

```
         ┌─────────────────┐
         │   Unit Tests    │  5%  - Pure utilities only
         └────────┬────────┘
                  │
    ┌─────────────┴─────────────┐
    │   Integration Tests       │  95% - JSON-RPC → Database
    └─────────────┬─────────────┘
                  │
         ┌────────┴────────┐
         │   E2E Tests     │  Frontend flows (Playwright)
         └─────────────────┘
```

Testing flows should mirror the architecture defined in
[architecture.md](.spec/steering/architecture.md).

## Test Types

### Unit Tests (5% of suite)

**Purpose**: Pure utility functions with no side effects.

**Tool**: `node:test`

### Integration Tests (95% of suite)

**Purpose**: All business logic.

**Pattern**: JSON‑RPC payload → dispatcher → database state.

**Critical Rule**: Do NOT mock Prisma. Use a real database.

**Tool**: `node:test` + real DB

### E2E Tests (Frontend Only)

**Tool**: Playwright

### Smoke Tests (Transports Only)

**Goal**: Verify server boots and routes to core dispatcher.

## Test Organization

| Package | Test Location | Naming |
|---------|---------------|--------|
| packages/core | Colocated: `feature.test.ts` | `*.test.ts` |
| packages/contract | Colocated: `schema.test.ts` | `*.test.ts` |
| apps/http-api | `src/*.test.ts` | `*.test.ts` |
| apps/web | `tests/*.spec.ts` | `*.spec.ts` |

## Agent Instructions

### Backend Testing Pattern

```typescript
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../lib/rpc-server.js';
import { prisma } from '../lib/prisma.js';

describe('user.create', () => {
  before(async () => {
    await prisma.user.deleteMany();
  });

  it('creates user in database', async () => {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'user.create',
      params: { email: 'agent@example.com', name: 'Agent' },
    };

    const result = await dispatch(payload);

    assert.ok(result.result?.id);
    const dbUser = await prisma.user.findFirst();
    assert.equal(dbUser?.email, 'agent@example.com');
  });
});
```

### Contract Testing (Zod)

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CreateUserInput } from './user.schema.js';

describe('CreateUserInput', () => {
  it('accepts valid input', () => {
    const result = CreateUserInput.safeParse({ name: 'Test', email: 'test@test.com' });
    assert.ok(result.success);
  });

  it('rejects invalid email', () => {
    const result = CreateUserInput.safeParse({ name: 'Test', email: 'invalid' });
    assert.ok(!result.success);
  });
});
```

## Anti‑Patterns (FORBIDDEN)

| Anti‑Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| `jest.mock('prisma')` | Mock drifts from reality | Use real DB |
| `vi.mock('@my/core')` | Testing mock, not code | Test through dispatcher |
| Unit tests for services | Fragile, coupled to impl | Integration tests |
| Mocking HTTP clients | Miss real API behavior | Use dispatcher payloads |
| Testing internal functions | Coupled to impl | Test public API |
| Snapshot tests for logic | Don’t catch bugs | Assert specific values |

## Coverage Expectations

| Metric | Target |
|--------|--------|
| Line Coverage | 80% minimum |
| Branch Coverage | 70% minimum |
| Integration Tests | Every RPC method must have at least one test |
| E2E Tests | Every critical user flow must have a test |
