create table if not exists rwt_runs (
  id          text primary key,
  user_id     text not null,
  name        text not null,
  well_id     text not null,
  source      text not null default 'demo',
  metrics     text not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists rwt_runs_user_id_idx on rwt_runs (user_id);
create index if not exists rwt_runs_created_idx on rwt_runs (created_at desc);
