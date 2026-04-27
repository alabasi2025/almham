CREATE TYPE monitoring_target_type AS ENUM (
  'generator',
  'sync_panel',
  'feeder_panel',
  'feeder',
  'main_segment',
  'branch_segment',
  'panel'
);

CREATE TYPE monitoring_meter_kind AS ENUM (
  'production',
  'distribution',
  'consumption',
  'load',
  'voltage',
  'loss_check'
);

CREATE TYPE monitoring_meter_status AS ENUM (
  'active',
  'inactive',
  'maintenance',
  'alarm'
);

CREATE TABLE monitoring_meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  code varchar(64),
  target_type monitoring_target_type NOT NULL,
  target_id uuid,
  kind monitoring_meter_kind NOT NULL DEFAULT 'load',
  last_voltage numeric(10, 2),
  last_current numeric(10, 2),
  last_kwh numeric(14, 2),
  last_power_kw numeric(10, 2),
  load_percent integer,
  status monitoring_meter_status NOT NULL DEFAULT 'active',
  last_read_at timestamp,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX monitoring_meters_station_idx ON monitoring_meters(station_id);
CREATE INDEX monitoring_meters_target_idx ON monitoring_meters(target_type, target_id);
CREATE INDEX monitoring_meters_status_idx ON monitoring_meters(status);
