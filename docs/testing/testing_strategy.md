# Testing Strategy

## Current Priorities

- Verify Supabase auth flows
- Verify protected route behavior
- Verify event discovery and saved event interactions
- Verify profile and event creation screens still render correctly

## Manual Checks

1. Sign up with a new account
2. Log in with that account
3. Refresh on a protected route and confirm the session persists
4. Log out and confirm redirect to `#/auth/login`
5. Create and save events to confirm `EventContext` still behaves correctly

## Automation Targets

- Add React component tests for auth pages
- Add route guard tests
- Add context tests for saved events and created events
