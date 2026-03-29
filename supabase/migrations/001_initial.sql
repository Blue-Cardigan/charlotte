create extension if not exists pgcrypto;

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  color_primary text not null default '#17152f',
  color_secondary text,
  color_accent text not null default '#ff4f7f',
  color_background text not null default '#fffaf7',
  persona_name text not null default 'Charlotte',
  persona_tone text not null default 'Warm, curious, and naturally conversational',
  voice_id text,
  welcome_heading text,
  welcome_body text,
  created_at timestamptz not null default now()
);

create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  extra_context text,
  created_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create table if not exists survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'open_ended' check (question_type in ('open_ended', 'rating', 'multiple_choice', 'yes_no')),
  options jsonb,
  order_index int not null default 0,
  required boolean not null default true,
  follow_up_hint text,
  created_at timestamptz not null default now()
);

create table if not exists survey_sessions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  elevenlabs_conversation_id text,
  transcript jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  respondent_email text
);

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references survey_sessions(id) on delete cascade,
  question_id uuid not null references survey_questions(id) on delete cascade,
  raw_excerpt text,
  extracted_answer text,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  created_at timestamptz not null default now()
);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text unique not null,
  brand_id uuid references brands(id) on delete set null,
  role text not null default 'brand_admin' check (role in ('super_admin', 'brand_admin')),
  created_at timestamptz not null default now()
);
