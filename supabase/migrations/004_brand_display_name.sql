alter table brands
  add column if not exists display_name text;

update brands
set display_name = name
where display_name is null;
