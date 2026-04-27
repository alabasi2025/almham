-- Migration: Add route_coordinates to feeders table
-- This stores the cable route as an array of [lat, lng] coordinate pairs
-- Example: [[15.3694, 44.1910], [15.3700, 44.1920], ...]

ALTER TABLE feeders
ADD COLUMN route_coordinates jsonb;

COMMENT ON COLUMN feeders.route_coordinates IS 'Array of [lat, lng] pairs representing the cable route path';
