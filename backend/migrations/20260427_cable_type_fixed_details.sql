ALTER TABLE cable_types
  ADD COLUMN IF NOT EXISTS phase_config cable_phase_config NOT NULL DEFAULT 'single_phase_earth',
  ADD COLUMN IF NOT EXISTS earth_mode earth_mode NOT NULL DEFAULT 'insulated';
