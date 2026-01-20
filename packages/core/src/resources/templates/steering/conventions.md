# Default Coding Conventions

When project analysis is incomplete or for new projects, use these opinionated defaults.
**User-defined patterns ALWAYS override these defaults.** Only use defaults to fill gaps.

**See also**: [architecture.md](.spec/steering/architecture.md) for system structure and diagrams.

## 1. Code Anatomy (Vertical Slices)

**Core Principle**: Organize code by **Feature**, not by technical layer.

### Forbidden Folders

Agents must NEVER create these:

```
src/controllers/
src/services/
src/repositories/
src/dtos/
src/entities/
src/models/
```

### Required Structure

```
src/modules/[feature-name]/
```

### Canonical Layout

```
src/
├── modules/
│   ├── health/
│   │   ├── health.methods.ts
│   │   ├── health.schema.ts
│   │   └── health.test.ts
│   ├── user/
│   │   ├── user.methods.ts
│   │   ├── user.schema.ts
│   │   └── user.test.ts
├── lib/
│   ├── prisma.ts
│   ├── rpc-server.ts
│   └── http-entry.ts
├── main.ts
└── schema.prisma
```

## 2. Default Patterns

- **No classes for logic**: use pure functions
- **Explicit context**: pass userId/context as arguments
- **Schemas first**: define Zod schema, derive types via `z.infer<typeof schema>`
- **Colocated tests**: tests live next to the module
- **File naming**: `feature.methods.ts`, `feature.schema.ts`, `feature.test.ts`

## 3. Architecture Alignment (High‑Level)

- Follow the dispatcher and transport rules in [architecture.md](.spec/steering/architecture.md).
- Conventions here focus on naming, structure, and style.

## 4. Code Style

| Setting | Value |
|---------|-------|
| Indentation | 2 spaces |
| Line length | 100 characters |
| Semicolons | Required |
| Trailing commas | ES5 |
| Quotes | Single quotes |

## 5. Import Order

1. Node built-ins (`node:http`, `node:test`)
2. External packages (`zod`, `@prisma/client`)
3. Monorepo packages (`@my/core`, `@my/contract`)
4. Relative imports (`./`, `../`)

## 6. Database Access

- Use a singleton `PrismaClient` in `lib/prisma.ts`.
- Prefer `prisma.model.find...` over raw SQL unless required.
- Avoid `Unchecked` inputs unless strictly necessary.

## 7. Agentic Guidelines (Prompt Rules)

- **Zero hallucination**: prefer Node built-ins (`node:fs`, `node:path`, `crypto.randomUUID()`).
- **No magic middleware**: pass values explicitly; no global contexts.
- **Type safety**: schema first; `z.infer` types from schemas.
- **Testing**: assume real DB; never mock Prisma.

## 8. Error Handling

**Fail fast, fail loud**. Errors propagate to boundaries for logging and formatting.

| Layer | Error Handling | Rationale |
|-------|---------------|-----------|
| Domain/Methods | Throw `AppError` | Business rules express intent |
| Dispatcher | Transform to JSON‑RPC error | Protocol boundary |
| Transport | Log + return formatted response | External boundary |

### Zod Validation Errors

```typescript
import { z } from 'zod';
import { ValidationError } from '../lib/errors.js';

export async function createUser(params: unknown) {
  const parsed = CreateUserInput.safeParse(params);
  if (!parsed.success) {
    throw new ValidationError('Invalid input', parsed.error.errors);
  }
  return parsed.data;
}
```
