ALPHA CORE V2.2 REQUIRES ONE DATABASE MIGRATION.

1) Open Supabase > SQL Editor > New query.
2) Paste the complete contents of upgrade_v2_2.sql.
3) Press Run.
4) Continue only after seeing: Success. No rows returned.

The migration keeps all existing users, months, holdings and performance history.
It creates a default portfolio and attaches all existing months to it.
