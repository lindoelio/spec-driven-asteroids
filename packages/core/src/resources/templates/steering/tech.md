# Default Technology Stack

When project analysis is incomplete or for new projects, use these opinionated defaults.
**User-defined values ALWAYS override these defaults.** Only use defaults to fill gaps.

## 1. Technology Stack (Strict)

**See also**: [architecture.md](.spec/steering/architecture.md) for system structure and diagrams.

| Component | Choice | Version | Notes |
|-----------|--------|---------|-------|
| Runtime | Node.js | v24 LTS+ | Must support `process.loadEnvFile()` |
| Language | TypeScript | Strict | `"strict": true` in tsconfig |
| Execution | tsx | Latest | Run TS without build steps |
| Protocol | JSON-RPC 2.0 | Spec | Transport agnostic |
| Database/ORM | Prisma | v5.x | Singleton `PrismaClient` |
| Validation | Zod | v3.x | Schemas define contracts |
| Testing | node:test | Native | `node:assert/strict` |
| Env Loading | Node built-in | Native | `process.loadEnvFile()` |

## 2. Architecture (High‑Level)

- Architectural details live in [architecture.md](.spec/steering/architecture.md).
- Tech-level focus: keep dependencies minimal and standard-driven.

## 3. Required Structure

```
src/
├── modules/
│   ├── [feature-name]/
│   │   ├── [feature].methods.ts
│   │   ├── [feature].schema.ts
│   │   └── [feature].test.ts
├── lib/
│   ├── prisma.ts
│   ├── rpc-server.ts
│   └── http-entry.ts
├── main.ts
└── schema.prisma
```

## 4. JSON-RPC Standard (Strict)

**Success**:

```json
{ "jsonrpc": "2.0", "result": { ... }, "id": 1 }
```

**Error**:

```json
{ "jsonrpc": "2.0", "error": { "code": -32600, "message": "Invalid Request" }, "id": null }
```

## 5. Forbidden Technologies

| Technology | Reason |
|------------|--------|
| Express/Fastify/NestJS | Framework magic—use native Node.js http |
| Jest/Vitest | Unnecessary—use node:test |
| AsyncLocalStorage/cls-hooked | Hidden context—pass explicitly |
| Decorators | Magic—use explicit function calls |
| Class-based DI | Hidden wiring—use explicit factories |
| Active Record ORMs | Hidden queries—use explicit Prisma calls |
