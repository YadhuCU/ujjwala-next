# user

**Purpose.** Accounts. A user holds **one or more** roles; permissions are the union.

**Files.** `src/module/user/*` · UI `src/app/(dashboard)/users/` ·
tests `user.service.integration.test.ts`

**Model.** `User { id, uuid, username (@unique, never updated), name?, password
(bcrypt), isActive, email?, mobile?, isDeleted }` ↔ `UserRole` ↔ `Role`.
The serializer strips `password`; it is the only path a user takes to a response.

**Guards.**
- `assertRolesExist`; `replaceUserRoles` refuses an **empty** list (a user with no
  roles authenticates, then 403s on everything).
- `assertNotLastOwner` — the last active holder of a **system** role cannot be
  deleted, deactivated or demoted. Keyed on `role.isSystem`: it used to match the
  name `"OWNER"`, which would have failed *open* after a rename.
- `assertNotSelf` — cannot delete or deactivate yourself.
- **Escalation** (`updateUser(id, input, actor)` — it took no actor before
  2026-08-16): only an owner may grant a system role; a non-owner cannot change
  their own role assignments; only an owner may change an owner's password.

**Writes.** Blank password on edit keeps the hash. Role changes, deactivation and
delete call `invalidateRbac(id)` so they bite on the next request, and role
changes write a `USER_ROLES_CHANGED` audit entry (only when something changed).
Activation is `PATCH /api/users/[id]`, separate from delete.

**Form.** Roles are a checkbox list (multi-select). It was a single-select that
silently dropped a multi-role user's other roles on save.

**Routes.** `GET/POST /api/users`, `GET/PUT/PATCH/DELETE /api/users/[id]` —
`user.read / create / update (PUT and PATCH) / delete`.

**Seeded accounts.** `owner`, `office`, `field`. Dev password `owner123` etc.; on
UAT a generated password (kept outside the repo) — change them at `/users`.
