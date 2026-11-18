# SQL to run

Written 2026-11-18 on `family-board-tab`; updated on `sentence-fix` the same day. Nothing here has been run: run it yourself, in both Supabase projects (development first, then production), before a build with these changes reaches anyone.

## This branch adds no SQL

The brief asked for two new columns on the board's notes, `author_name` and `author_relation`. They aren't needed: `public.family_notes` already has them, as `from_name` and `from_relationship`, nullable and 1 to 40 letters each (a check). The app already reads and writes them, and the cards show them. Adding a second pair would store the same thing twice. `docs/FAMILY-BOARD-TAB-PLAN.md`, section 2, has the reasoning.

## Still to run from `main`: the whole schema

`family_notes` and the `cards.wording` column are both new on `main` (2026-11-18) and haven't been run in either project yet. Until `cards.wording` exists, every card reads in the old wording and **Refresh wording** says the update is needed (`sentence-fix` keeps saving working meanwhile). `sentence-fix` itself adds no SQL. In each project:

1. **SQL Editor → New query.**
2. Paste the whole of `supabase/schema.sql` (`pbcopy < supabase/schema.sql`).
3. **Run.**

The file is written to be rerun, so running it again is safe. It needs no Edge Function redeploy.

## To confirm afterwards

The wording column (it should say `smallint`, `NO`, default `1`):

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'cards' and column_name = 'wording';
```

The board's author columns:

Run this in each project. It should list the two author columns, both nullable:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'family_notes'
  and column_name in ('from_name', 'from_relationship')
order by column_name;
```

Expected:

| column_name | data_type | is_nullable |
| --- | --- | --- |
| from_name | text | YES |
| from_relationship | text | YES |
