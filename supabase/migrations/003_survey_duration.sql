alter table surveys
  add column if not exists duration_minutes int not null default 10;
