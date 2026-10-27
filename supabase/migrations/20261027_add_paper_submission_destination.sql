alter table public.paper_submissions
  add column if not exists destination text;
