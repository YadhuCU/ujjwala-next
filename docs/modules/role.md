# role (RBAC administration)

**Purpose.** Roles as data, managed from `/roles`; the permission catalogue as code.
Configuration guide for humans: `docs/RBAC.md`. Runtime mechanics: `_platform.md`.

**Files.** `src/module/role/{role.*,rbac-audit.service,rbac-audit.serializer}.ts`,
`src/lib/permissions.ts` · UI `src/app/(dashboard)/roles/` (list, add, edit with
permission matrix, `/roles/audit`) · tests `role.service.integration.test.ts`,
`rbac-audit.service.integration.test.ts`, `src/lib/permissions.test.ts`

**Catalogue (`src/lib/permissions.ts`).** `PERMISSIONS` = the codes (58), what
`withAuth` checks. `PERMISSION_REGISTRY` = module + label + description per code;
a unit test fails if a code is missing from it, so nothing enforceable is
ungrantable. `SCOPES` = the own/all pairs (EXPENSE, REPORT, DASHBOARD). `ROLES` =
names of the three seeded roles — used only where the system role is structurally
special, never to authorize. Codes are **not** creatable from the UI: a code no
route checks would grant nothing. 12 never-checked codes were retired 2026-08-16
(including the sale `.read.own/.all` pairs — sale lists are not scoped).

**Models.** `Role { name (@unique), description?, isSystem, createdAt, updatedAt
@default(now()) }`, `Permission { code (@unique), module, label, sortOrder }`,
`RolePermission`, `RbacAuditLog { action, actorId?, actorName?, roleId?, roleName?,
targetUserId?, targetUserName?, added[], removed[], createdAt }`.

**Guards.** `assertRoleEditable` (a system role cannot be renamed, edited or
deleted — by anyone); `assertNameAvailable` (case-insensitive); `assertMayGrant`
(a non-owner cannot grant a code it does not hold); `assertRoleUnassigned` (no
delete while held — `UserRole` cascades would strip it silently);
`replaceRolePermissions` refuses codes missing from the DB ("run the seed").
Payload never accepts `isSystem`.

**System role.** `OWNER` is `isSystem`. It passes every check in code
(`isOwner` short-circuit), so a newly added permission works for it before the
seed runs; the seed also re-grants it everything each run. The serializer reports
every code for it. Lockout recovery: `SEED_FORCE_OWNER_PASSWORD=1`.

**Audit.** `writeRbacAudit(tx, …)` takes the transaction first (like
`writeStockAdjustment`), so the entry commits with the change. Append-only.
Names are **denormalised** — the entry must outlive the role, user or actor it
describes (actor FK is `SetNull`). Actions: `ROLE_CREATED` / `ROLE_UPDATED` (diff
only) / `ROLE_DELETED` / `USER_ROLES_CHANGED`. Readable at `/roles/audit`.

**Starter roles** (seeded once, then editable; never re-granted): OFFICE_STAFF
(19 codes), FIELD_STAFF (15). A seed backfill grants `.read.own` wherever a role
holds a module read with no scope.

**Routes.** `GET/POST /api/roles` (`?options=true` for the user form's picker),
`GET/PUT/DELETE /api/roles/[id]`, `GET /api/roles/audit`, `GET /api/permissions`
(catalogue grouped by module) — `role.read / create / update / delete`.
Mutations call `invalidateRbac` for every holder and `useSession().update({…})`
**with an argument** client-side (no argument = a GET, no update trigger).
