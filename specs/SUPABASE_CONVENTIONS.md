# StockRight — Supabase conventions (MVP)

This file mirrors implementation rules that also belong in `.cursor/rules/` (see **Note** below). **Source of truth for SQL shapes** remains [`API_AND_SCHEMA_SPEC.md`](API_AND_SCHEMA_SPEC.md).

## Backend boundary

- **MVP: no separate Node/Express/Hono server.** Use Supabase Auth, Postgres, PostgREST, RLS, Storage, and Edge Functions (cron/jobs, complex mutations).

## Identity

- **`auth.users`**: golden source for authentication (**phone**; no product email).
- **`public.user_profiles`**: `id` = `auth.users.id`, profile fields (`phone`, `display_name`, optional `avatar_url`, `is_active`, timestamps).
- **`public.user_roles`**: `(user_id, tenant_id, role)` with `UNIQUE (user_id, tenant_id)`.
- **`public.user_warehouse_assignments`**: `(user_id, warehouse_id, assigned_at)`.

**MVP**: usually one `user_roles` row per user. Multi-tenant users require an explicit **`active_tenant_id`** (or equivalent) before `current_tenant_id()` can be unambiguous.

## Roles (canonical enum)

`OWNER`, `MANAGER`, `STAFF`.

## RLS helpers

Define in **`public`** (not `auth` schema), e.g.:

- `public.current_tenant_id()` — `STABLE SECURITY DEFINER`, typically `SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1`.
- `public.accessible_warehouse_ids()` — warehouses the user may access.

Use `SET search_path = public` on `SECURITY DEFINER` functions.

## Triggers

- **Avoid** a large set of `BEFORE INSERT` triggers that copy `tenant_id` from `warehouses`.
- Prefer **RLS** that joins `warehouse_id` → `warehouses.tenant_id` and checks `current_tenant_id()` + assignments.
- Where a `tenant_id` column exists, consider **`DEFAULT public.current_tenant_id()`** and **`WITH CHECK (tenant_id = public.current_tenant_id())`** so clients do not send `tenant_id`.
- **Optional**: only universal low-cost triggers (e.g. `updated_at`).

## Client security

- Do **not** rely on client-supplied `tenant_id` for authorization.
- **OK** to filter by `warehouse_id` in the client for UX; RLS remains authoritative.

---
