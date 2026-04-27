CREATE TYPE feeder_panel_busbar_layout AS ENUM ('right', 'left', 'both');
CREATE TYPE feeder_panel_breaker_layout AS ENUM ('right', 'left', 'both');
CREATE TYPE feeder_panel_breaker_side AS ENUM ('right', 'left');
CREATE TYPE feeder_panel_breaker_status AS ENUM ('active', 'inactive', 'maintenance');

ALTER TABLE panels
  ADD COLUMN busbar_layout feeder_panel_busbar_layout NOT NULL DEFAULT 'right',
  ADD COLUMN breaker_layout feeder_panel_breaker_layout NOT NULL DEFAULT 'both',
  ADD COLUMN busbar_material varchar(64) DEFAULT 'نحاس',
  ADD COLUMN busbar_rating_amps integer;

CREATE TABLE feeder_panel_breakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid NOT NULL REFERENCES panels(id) ON DELETE CASCADE,
  feeder_id uuid REFERENCES feeders(id) ON DELETE SET NULL,
  breaker_number varchar(64) NOT NULL,
  side feeder_panel_breaker_side NOT NULL DEFAULT 'right',
  rating_amps integer,
  breaker_type varchar(128),
  status feeder_panel_breaker_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX feeder_panel_breakers_panel_idx ON feeder_panel_breakers(panel_id);
CREATE INDEX feeder_panel_breakers_feeder_idx ON feeder_panel_breakers(feeder_id);
CREATE INDEX feeder_panel_breakers_side_idx ON feeder_panel_breakers(side);
