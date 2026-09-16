---
name: Supabase views and RLS
description: How this project’s browser-facing Supabase views depend on grants and policies on their base relations.
---

Supabase REST queries against a view can fail even when the view itself has `SELECT` access. In this project, the browser-facing views depend on base relations with RLS enabled, so the roles used by the publishable key need explicit `SELECT` grants and narrowly scoped policies on those base relations.

**Why:** The REST API returned `permission denied for table ...` while the target view existed and had a `SELECT` grant. Inspecting `information_schema` and `pg_class` showed that the missing access was on the underlying RLS-protected base table.

**How to apply:** When a Supabase view-backed endpoint fails, inspect the full view dependency chain, check grants and `pg_policies` on each base relation, and scope any public policy to the intended tenant/company and operation. Do not assume a policy on the view is possible or sufficient.