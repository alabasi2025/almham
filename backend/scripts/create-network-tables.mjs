import postgres from 'postgres';
import { config } from 'dotenv';
config();

const pg = postgres(process.env.DATABASE_URL);

await pg.unsafe(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feeder_status') THEN
      CREATE TYPE feeder_status AS ENUM ('active', 'off', 'maintenance', 'overloaded');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'panel_type') THEN
      CREATE TYPE panel_type AS ENUM ('sync', 'main_distribution', 'meter_box');
    END IF;
  END $$;

  CREATE TABLE IF NOT EXISTS feeders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64),
    responsible_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    cable_type VARCHAR(128),
    max_load_amps INTEGER,
    length_meters INTEGER,
    status feeder_status NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS panels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    feeder_id UUID REFERENCES feeders(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64),
    type panel_type NOT NULL DEFAULT 'meter_box',
    controller_type VARCHAR(128),
    capacity_amps INTEGER,
    pole_number VARCHAR(64),
    max_slots INTEGER,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    status station_status NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS feeders_station_idx ON feeders(station_id);
  CREATE INDEX IF NOT EXISTS panels_station_idx ON panels(station_id);
  CREATE INDEX IF NOT EXISTS panels_feeder_idx ON panels(feeder_id);
  CREATE INDEX IF NOT EXISTS panels_type_idx ON panels(type);
`);

console.log('✅ جداول feeders + panels تم إنشاؤها بنجاح');
await pg.end();
