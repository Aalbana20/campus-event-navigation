-- Fix post engagement RLS gaps.
-- 1. discover_post_shares SELECT was restricted to own rows, which means
--    loadPostEngagementSummary on web returns 0 share counts for all posts
--    because the query reads other users' rows.
-- 2. Tighten discover_post_comment_likes created_at to NOT NULL (safe additive).

-- Fix: allow any authenticated user to read share rows (for counts).
-- The row content (user_id, method) is not sensitive — share counts are public.
drop policy if exists "Users can read own shares" on public.discover_post_shares;

create policy "Authenticated users can read post shares"
  on public.discover_post_shares for select
  to authenticated
  using (true);

-- Fix: created_at on discover_post_comment_likes should not be nullable.
alter table public.discover_post_comment_likes
  alter column created_at set not null,
  alter column created_at set default now();
