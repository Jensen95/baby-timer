# Supabase Migration Skill

## Trigger

Load when: creating a new database migration, modifying schema, adding tables/columns/policies.

## Creating a migration

1. Create file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Use timestamp format matching existing files
3. After creating: regenerate types with:
   ```bash
   supabase gen types typescript --local > src/lib/db/database.types.ts
   ```
   (Only works if `supabase start` is running locally)
4. If no local Supabase, manually update `src/lib/db/database.types.ts`

## Migration conventions

- One concern per migration file
- Always `enable row level security` on new tables
- Use `auth.uid()` in RLS policies
- Denormalize `family_id` on session tables for simple RLS (no subquery joins)
- Generated columns: use `generated always as (...) stored` for computed values

## RLS pattern for family-scoped tables

```sql
create policy "family member access"
  on public.some_table for all
  using (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid()
    )
  )
  with check (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid()
    )
  );
```
