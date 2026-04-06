# Data Notes

## Current State

- Authentication is managed by Supabase Auth
- Supabase Auth users live in the Supabase dashboard under Authentication > Users
- Event data in the current UI is stored in `EventContext` for local app behavior

## If Persisted Later

Recommended tables for a future Supabase Postgres data model:

- `profiles`
- `events`
- `event_attendees`
- `event_categories`
- `event_tags`

## Important Constraint

Do not store plaintext passwords in app tables. Authentication should continue to rely on Supabase Auth.
