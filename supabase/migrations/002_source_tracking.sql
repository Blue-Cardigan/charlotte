alter table survey_sessions
  add column if not exists source text,
  add column if not exists referrer text,
  add column if not exists landing_path text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text;

create index if not exists survey_sessions_source_idx on survey_sessions (source);
create index if not exists survey_sessions_utm_source_idx on survey_sessions (utm_source);
