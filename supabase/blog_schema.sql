create extension if not exists pgcrypto;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body_html text not null,
  cover_image_url text,
  cover_image_path text,
  image_alt text,
  author_name text not null default 'WellTechAI CIC',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists blog_posts_status_published_idx
  on public.blog_posts (status, published_at desc);

create index if not exists blog_posts_created_idx
  on public.blog_posts (created_at desc);

create or replace function public.set_blog_post_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;

create trigger trg_blog_posts_updated_at
before update on public.blog_posts
for each row
execute function public.set_blog_post_updated_at();

alter table public.blog_posts enable row level security;

drop policy if exists "Public can read published blog posts" on public.blog_posts;
create policy "Public can read published blog posts"
on public.blog_posts
for select
using (status = 'published');

insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public can read blog images" on storage.objects;
create policy "Public can read blog images"
on storage.objects
for select
using (bucket_id = 'blog-images');

comment on table public.blog_posts is
'Blog posts for the public /blog feed and /blog/:slug article pages.';
