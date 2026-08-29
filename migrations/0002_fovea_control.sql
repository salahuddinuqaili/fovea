-- Fovea v1 control-plane snapshot. Unowned (auth OFF): world-readable through
-- public server functions. Personal memory and personal skills MUST NOT be
-- written here — see src/kernel/durable.ts.
create table if not exists fovea_control_snapshot (
  id         text primary key,
  payload    text not null,
  updated_at timestamptz not null default now()
);
