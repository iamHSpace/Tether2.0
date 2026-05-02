create extension if not exists "pgcrypto";

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamp default now()
);

create table profiles (
  user_id uuid references users(id),
  name text,
  bio text,
  milestone text,
  north_star text,
  utility text,
  primary key (user_id)
);

create table platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  platform text,
  access_token text,
  refresh_token text,
  expires_at timestamp,
  created_at timestamp default now()
);

create table raw_api_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  platform text,
  endpoint text,
  response jsonb,
  fetched_at timestamp default now()
);

create table creator_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  date date,
  platform text,
  followers int,
  reach int,
  impressions int,
  engagement int
);