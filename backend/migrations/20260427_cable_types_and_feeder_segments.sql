-- Cable Types: lookup table for cable types used in feeders
CREATE TABLE cable_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  size_mm NUMERIC(6,1),
  material VARCHAR(64),
  max_amps INTEGER,
  color VARCHAR(7) DEFAULT '#6b7280',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Feeder Segments: cable segments with tree structure for branches
CREATE TABLE feeder_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feeder_id UUID NOT NULL REFERENCES feeders(id) ON DELETE CASCADE,
  parent_segment_id UUID REFERENCES feeder_segments(id) ON DELETE SET NULL,
  cable_type_id UUID REFERENCES cable_types(id) ON DELETE SET NULL,
  segment_type VARCHAR(16) NOT NULL DEFAULT 'main' CHECK (segment_type IN ('main', 'branch')),
  order_index INTEGER NOT NULL DEFAULT 0,
  label VARCHAR(255),
  length_meters NUMERIC(8,1),
  route_points JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX feeder_segments_feeder_idx ON feeder_segments(feeder_id);
CREATE INDEX feeder_segments_parent_idx ON feeder_segments(parent_segment_id);
CREATE INDEX feeder_segments_cable_type_idx ON feeder_segments(cable_type_id);
