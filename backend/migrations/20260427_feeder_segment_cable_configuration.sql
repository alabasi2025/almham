DO $$ BEGIN
  CREATE TYPE cable_phase_config AS ENUM (
    'single_phase_earth',
    'two_phase_earth',
    'three_phase_earth',
    'earth_only',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE earth_mode AS ENUM ('insulated', 'bare', 'none');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE feeder_segments
  ADD COLUMN IF NOT EXISTS phase_config cable_phase_config NOT NULL DEFAULT 'single_phase_earth',
  ADD COLUMN IF NOT EXISTS earth_mode earth_mode NOT NULL DEFAULT 'insulated';
