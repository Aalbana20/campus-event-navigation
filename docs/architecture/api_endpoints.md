# Client Routes and Auth Flow

This project is currently frontend-only for authentication.

## Client Routes

- `#/auth/login`
- `#/auth/signup`
- `#/auth/logout`
- `#/discover`
- `#/events`
- `#/create`
- `#/profile`

## Auth Actions

- Signup: `supabase.auth.signUp(...)`
- Login: `supabase.auth.signInWithPassword(...)`
- Logout: `supabase.auth.signOut(...)`

## Notes

- There is no active custom backend API in the current app
- Route protection is based on the active Supabase session
- A lightweight `localStorage` `user` object is still kept for existing UI state
