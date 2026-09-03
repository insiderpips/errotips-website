-- Paleisti Supabase SQL Editor'e vieną kartą
alter table leads add column if not exists lang text default 'lt';
