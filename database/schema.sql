-- ==============================================================================
-- QuickPic Multi-Tenant Photobooth Ecosystem Schema
-- Architecture Specification: concept.md
-- Hierarchy: Owner (Vendor) > Photobooth (Kiosk) > Sessions / Telemetry / Settings
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. OWNERS TABLE
-- Represents the business entity / vendor (e.g., SnapStudio Inc)
-- Ties directly to Supabase Auth uid or custom vendor UUID
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owners (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2. PHOTOBOOTHS TABLE
-- Represents individual physical stations running QuickPic Electron desktop app
-- Scoped to an Owner, authenticated via pairing_code or device_token
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photobooths (
    id TEXT PRIMARY KEY, -- e.g. 'booth-jkt-01' or nanoid
    owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    device_token TEXT UNIQUE,
    pairing_code VARCHAR(6),
    pairing_code_expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
    last_seen_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 3. SESSIONS TABLE
-- Guest photos, composites, Live Photo Boomerangs, download links
-- Foreign key references photobooths(id) with ON DELETE CASCADE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, -- Session UUID or NanoID
    booth_id TEXT NOT NULL REFERENCES photobooths(id) ON DELETE CASCADE,
    event_id TEXT,
    package_id TEXT NOT NULL DEFAULT 'strip',
    raw_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    composite_url TEXT NOT NULL,
    live_photos JSONB DEFAULT '[]'::jsonb,
    layout TEXT DEFAULT 'strip-3',
    filter TEXT DEFAULT 'none',
    theme_id TEXT,
    selected_template_id TEXT,
    slot_adjustments JSONB DEFAULT '[]'::jsonb,
    payment JSONB DEFAULT '{}'::jsonb,
    consent JSONB DEFAULT '{}'::jsonb,
    guest_download_url TEXT,
    print_status TEXT DEFAULT 'not_requested' CHECK (print_status IN ('not_requested', 'queued', 'printed')),
    storage_path TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 4. TELEMETRY TABLE
-- 1-minute device heartbeats (Canon DSLR connection, DNP ribbon remaining, PC load)
-- Foreign key references photobooths(id) with ON DELETE CASCADE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telemetry (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    booth_id TEXT NOT NULL REFERENCES photobooths(id) ON DELETE CASCADE,
    ribbon_remaining INTEGER NOT NULL DEFAULT 700 CHECK (ribbon_remaining >= 0),
    ribbon_percentage NUMERIC(5,2) DEFAULT 100.0,
    queue_depth INTEGER DEFAULT 0,
    cpu_pct NUMERIC(5,2) DEFAULT 0.0,
    ram_pct NUMERIC(5,2) DEFAULT 0.0,
    camera_connected BOOLEAN DEFAULT false,
    camera_model TEXT DEFAULT 'Canon DSLR',
    printer_connected BOOLEAN DEFAULT false,
    printer_name TEXT DEFAULT 'DNP DS-RX1HS',
    pinged_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 5. BOOTH_SETTINGS TABLE
-- Event names, hashtags, active frame templates, audio cues, staff bypass PIN
-- 1-to-1 relationship with photobooths, CASCADE on deletion
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booth_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    booth_id TEXT NOT NULL UNIQUE REFERENCES photobooths(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL DEFAULT 'QuickPic Photobooth Event',
    event_date TEXT,
    event_hashtag TEXT DEFAULT '#QuickPic',
    layout TEXT DEFAULT 'strip-3',
    countdown_seconds INTEGER DEFAULT 5,
    show_flash_effect BOOLEAN DEFAULT true,
    play_audio_cues BOOLEAN DEFAULT true,
    selected_filter TEXT DEFAULT 'none',
    selected_theme_id TEXT DEFAULT 'classic-black',
    custom_overlay_url TEXT,
    mirror_camera BOOLEAN DEFAULT true,
    print_enabled BOOLEAN DEFAULT true,
    hardware_daemon_url TEXT DEFAULT 'http://localhost:8000',
    staff_bypass_pin TEXT DEFAULT '1144',
    settings_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- INDEXES FOR MULTI-TENANT QUERY OPTIMIZATION
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_photobooths_owner_id ON photobooths(owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_booth_id ON sessions(booth_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_booth_id ON telemetry(booth_id);

-- Additional indexing for pairing, auth, and time-series aggregation
CREATE INDEX IF NOT EXISTS idx_photobooths_pairing_code ON photobooths(pairing_code) WHERE pairing_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_photobooths_device_token ON photobooths(device_token) WHERE device_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_pinged_at ON telemetry(pinged_at DESC);
CREATE INDEX IF NOT EXISTS idx_booth_settings_booth_id ON booth_settings(booth_id);

-- ==============================================================================
-- AUTOMATIC TIMESTAMPS
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_owners_updated_at ON owners;
CREATE TRIGGER trg_update_owners_updated_at
    BEFORE UPDATE ON owners
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_photobooths_updated_at ON photobooths;
CREATE TRIGGER trg_update_photobooths_updated_at
    BEFORE UPDATE ON photobooths
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_sessions_updated_at ON sessions;
CREATE TRIGGER trg_update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_booth_settings_updated_at ON booth_settings;
CREATE TRIGGER trg_update_booth_settings_updated_at
    BEFORE UPDATE ON booth_settings
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) FOUNDATION
-- Enables RLS on all multi-tenant tables.
-- Data Security Engineer will apply granular auth.uid() & device_token policies.
-- ==============================================================================
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE photobooths ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE booth_settings ENABLE ROW LEVEL SECURITY;
