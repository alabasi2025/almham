CREATE TYPE busbar_position AS ENUM ('right', 'left', 'middle');
CREATE TYPE busbar_role AS ENUM ('phase_a', 'phase_b', 'phase_c', 'neutral', 'earth', 'spare', 'other');

CREATE TABLE busbar_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(128) NOT NULL,
  material varchar(64) DEFAULT 'نحاس',
  width_mm numeric(8, 2),
  thickness_mm numeric(8, 2),
  rating_amps integer,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE feeder_panel_busbars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid NOT NULL REFERENCES panels(id) ON DELETE CASCADE,
  busbar_type_id uuid REFERENCES busbar_types(id) ON DELETE SET NULL,
  label varchar(128) NOT NULL,
  role busbar_role NOT NULL DEFAULT 'other',
  position busbar_position NOT NULL DEFAULT 'right',
  order_index integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX feeder_panel_busbars_panel_idx ON feeder_panel_busbars(panel_id);
CREATE INDEX feeder_panel_busbars_type_idx ON feeder_panel_busbars(busbar_type_id);
CREATE INDEX feeder_panel_busbars_position_idx ON feeder_panel_busbars(position);
