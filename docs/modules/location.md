# location

**Purpose.** A grouping for customers (district / locality / pincode). No history
of its own.

**Files.** `src/module/location/{location.form.schema,location.payload.schema,location.service,location.serializer}.ts`
· UI `src/app/(dashboard)/locations/` · tests `location.service.integration.test.ts`

**Model.** `Location { id, name?, district?, locality?, pincode?, createdAt, updatedAt }`.
`Customer.locationId` → `onDelete: SetNull`.

**Rules.**
- The **only hard delete** in the app. Deleting sets `locationId = null` on its
  customers; they simply lose the grouping. No soft-delete column exists.
- `assertLocationExists` is the only guard.

**Routes.** `GET/POST /api/locations` (`location.read` / `location.create`),
`GET/PUT/DELETE /api/locations/[id]` (`read` / `update` / `delete`).

**Gotcha.** The customer form's location dropdown needs `location.read`; a role
that can create customers but not read locations gets a 403 on that dropdown.
