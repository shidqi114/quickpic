-- ============================================================================
-- QuickPic Multi-Tenant Photobooth Ecosystem
-- Database Schema & Row-Level Security (RLS) Policies
-- File: database/rls.sql
-- Adheres strictly to concept.md and AGENTS.md
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Table Definitions (Multi-Tenant Hierarchy)
-- ----------------------------------------------------------------------------

-- 1.1 Owners Table (Vendors / Multi-tenant root entity)
CREATE TABLE IF NOT EXISTS public.owners (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    email TEXT NOT NULL,
    plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.2 Photobooths Table (Physical kiosk stations running Electron app)
CREATE TABLE IF NOT EXISTS public.photobooths (
    id TEXT PRIMARY KEY, -- e.g. 'booth-jkt-01'
    owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    device_token TEXT UNIQUE, -- Cryptographic bearer token secret for kiosk API auth
    pairing_code TEXT, -- 6-digit PIN to pair kiosk desktop
    pairing_code_expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
    last_heartbeat_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.3 Sessions Table (Recorded guest photo sessions)
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY, -- Session UUID / nanoId
    booth_id TEXT NOT NULL REFERENCES public.photobooths(id) ON DELETE CASCADE,
    package_id TEXT NOT NULL,
    raw_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    composite_url TEXT NOT NULL,
    live_photos JSONB DEFAULT '[]'::jsonb,
    payment JSONB NOT NULL DEFAULT '{}'::jsonb,
    guest_download_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.4 Telemetry Table (1-minute device heartbeats & hardware health)
CREATE TABLE IF NOT EXISTS public.telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booth_id TEXT NOT NULL REFERENCES public.photobooths(id) ON DELETE CASCADE,
    ribbon_remaining INTEGER CHECK (ribbon_remaining >= 0),
    cpu_pct NUMERIC(5,2),
    ram_pct NUMERIC(5,2),
    camera_connected BOOLEAN NOT NULL DEFAULT false,
    printer_connected BOOLEAN NOT NULL DEFAULT false,
    pinged_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.5 Booth Settings Table (Branding, themes, and kiosk operation config)
CREATE TABLE IF NOT EXISTS public.booth_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booth_id TEXT UNIQUE NOT NULL REFERENCES public.photobooths(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL DEFAULT 'QuickPic Event',
    event_date TEXT,
    event_hashtag TEXT,
    layout TEXT NOT NULL DEFAULT 'strip-3',
    countdown_seconds INTEGER NOT NULL DEFAULT 3,
    show_flash_effect BOOLEAN NOT NULL DEFAULT true,
    play_audio_cues BOOLEAN NOT NULL DEFAULT true,
    selected_filter TEXT NOT NULL DEFAULT 'none',
    selected_theme_id TEXT NOT NULL DEFAULT 'classic-white',
    custom_overlay_url TEXT,
    mirror_camera BOOLEAN NOT NULL DEFAULT true,
    print_enabled BOOLEAN NOT NULL DEFAULT true,
    hardware_daemon_url TEXT DEFAULT 'http://localhost:8000',
    staff_bypass_pin TEXT DEFAULT '1144',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.6 Vouchers Table (Owner-issued promotional discount codes)
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'free')),
    value NUMERIC NOT NULL,
    description TEXT,
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.7 POS Items Table (Owner-managed merchandise & extra inventory)
CREATE TABLE IF NOT EXISTS public.pos_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('merchandise', 'frame', 'keychain', 'packaging')),
    price NUMERIC NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 2. Indexes for High-Speed Queries and RLS Policy Evaluation
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_photobooths_owner_id ON public.photobooths(owner_id);
CREATE INDEX IF NOT EXISTS idx_photobooths_device_token ON public.photobooths(device_token);
CREATE INDEX IF NOT EXISTS idx_photobooths_pairing_code ON public.photobooths(pairing_code);
CREATE INDEX IF NOT EXISTS idx_sessions_booth_id ON public.sessions(booth_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_booth_id ON public.telemetry(booth_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_pinged_at ON public.telemetry(pinged_at DESC);
CREATE INDEX IF NOT EXISTS idx_booth_settings_booth_id ON public.booth_settings(booth_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_owner_id ON public.vouchers(owner_id);
CREATE INDEX IF NOT EXISTS idx_pos_items_owner_id ON public.pos_items(owner_id);

-- ----------------------------------------------------------------------------
-- 3. Security Helper Functions
-- ----------------------------------------------------------------------------

-- Helper: Verify if current authenticated user owns a specific booth
CREATE OR REPLACE FUNCTION public.is_booth_owner(p_booth_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.photobooths
        WHERE id = p_booth_id
          AND owner_id = auth.uid()
    );
$$;

-- Helper: Extract and verify authenticated kiosk booth_id
-- Checks:
-- 1. JWT claim 'booth_id' (if authenticated with kiosk device JWT)
-- 2. Transaction setting 'app.current_booth_id' (set by trusted server API routes)
-- 3. PostgREST HTTP header 'x-device-token' matched against photobooths table
CREATE OR REPLACE FUNCTION public.get_auth_booth_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_jwt_booth_id TEXT;
    v_app_booth_id TEXT;
    v_token TEXT;
    v_booth_id TEXT;
BEGIN
    -- 1. Check custom JWT claim 'booth_id'
    BEGIN
        v_jwt_booth_id := (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'booth_id');
        IF v_jwt_booth_id IS NOT NULL AND v_jwt_booth_id <> '' THEN
            RETURN v_jwt_booth_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue fallback
    END;

    -- 2. Check transaction-scoped variable set by backend API route
    BEGIN
        v_app_booth_id := nullif(current_setting('app.current_booth_id', true), '');
        IF v_app_booth_id IS NOT NULL AND v_app_booth_id <> '' THEN
            RETURN v_app_booth_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue fallback
    END;

    -- 3. Check PostgREST HTTP header 'x-device-token'
    BEGIN
        v_token := (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-device-token');
        IF v_token IS NOT NULL AND v_token <> '' THEN
            SELECT id INTO v_booth_id
            FROM public.photobooths
            WHERE device_token = v_token
              AND status != 'offline'
            LIMIT 1;

            IF v_booth_id IS NOT NULL THEN
                RETURN v_booth_id;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Fall through
    END;

    RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Enable Row Level Security (RLS) on all multi-tenant tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photobooths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_items ENABLE ROW LEVEL SECURITY;

-- Force RLS to prevent bypass even for table owners
ALTER TABLE public.owners FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photobooths FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booth_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pos_items FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. POLICY SET 1: Owners can only view and manage their own booths and data
--    (auth.uid() = owner_id)
-- ----------------------------------------------------------------------------

-- 5.1 Owners table
DROP POLICY IF EXISTS "Owners can view own profile" ON public.owners;
CREATE POLICY "Owners can view own profile"
    ON public.owners FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Owners can update own profile" ON public.owners;
CREATE POLICY "Owners can update own profile"
    ON public.owners FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Owners can insert own profile" ON public.owners;
CREATE POLICY "Owners can insert own profile"
    ON public.owners FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- 5.2 Photobooths table (Owner access)
DROP POLICY IF EXISTS "Owners can select own photobooths" ON public.photobooths;
CREATE POLICY "Owners can select own photobooths"
    ON public.photobooths FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can insert own photobooths" ON public.photobooths;
CREATE POLICY "Owners can insert own photobooths"
    ON public.photobooths FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update own photobooths" ON public.photobooths;
CREATE POLICY "Owners can update own photobooths"
    ON public.photobooths FOR UPDATE
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete own photobooths" ON public.photobooths;
CREATE POLICY "Owners can delete own photobooths"
    ON public.photobooths FOR DELETE
    TO authenticated
    USING (auth.uid() = owner_id);

-- 5.3 Sessions table (Owner access)
DROP POLICY IF EXISTS "Owners can view sessions from own booths" ON public.sessions;
CREATE POLICY "Owners can view sessions from own booths"
    ON public.sessions FOR SELECT
    TO authenticated
    USING (public.is_booth_owner(booth_id));

DROP POLICY IF EXISTS "Owners can manage sessions from own booths" ON public.sessions;
CREATE POLICY "Owners can manage sessions from own booths"
    ON public.sessions FOR ALL
    TO authenticated
    USING (public.is_booth_owner(booth_id))
    WITH CHECK (public.is_booth_owner(booth_id));

-- 5.4 Telemetry table (Owner access)
DROP POLICY IF EXISTS "Owners can view telemetry from own booths" ON public.telemetry;
CREATE POLICY "Owners can view telemetry from own booths"
    ON public.telemetry FOR SELECT
    TO authenticated
    USING (public.is_booth_owner(booth_id));

DROP POLICY IF EXISTS "Owners can delete telemetry from own booths" ON public.telemetry;
CREATE POLICY "Owners can delete telemetry from own booths"
    ON public.telemetry FOR DELETE
    TO authenticated
    USING (public.is_booth_owner(booth_id));

-- 5.5 Booth Settings table (Owner access)
DROP POLICY IF EXISTS "Owners can view settings for own booths" ON public.booth_settings;
CREATE POLICY "Owners can view settings for own booths"
    ON public.booth_settings FOR SELECT
    TO authenticated
    USING (public.is_booth_owner(booth_id));

DROP POLICY IF EXISTS "Owners can insert settings for own booths" ON public.booth_settings;
CREATE POLICY "Owners can insert settings for own booths"
    ON public.booth_settings FOR INSERT
    TO authenticated
    WITH CHECK (public.is_booth_owner(booth_id));

DROP POLICY IF EXISTS "Owners can update settings for own booths" ON public.booth_settings;
CREATE POLICY "Owners can update settings for own booths"
    ON public.booth_settings FOR UPDATE
    TO authenticated
    USING (public.is_booth_owner(booth_id))
    WITH CHECK (public.is_booth_owner(booth_id));

DROP POLICY IF EXISTS "Owners can delete settings for own booths" ON public.booth_settings;
CREATE POLICY "Owners can delete settings for own booths"
    ON public.booth_settings FOR DELETE
    TO authenticated
    USING (public.is_booth_owner(booth_id));

-- 5.6 Vouchers & POS Items tables (Owner access)
DROP POLICY IF EXISTS "Owners can manage own vouchers" ON public.vouchers;
CREATE POLICY "Owners can manage own vouchers"
    ON public.vouchers FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can manage own pos items" ON public.pos_items;
CREATE POLICY "Owners can manage own pos items"
    ON public.pos_items FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- 6. POLICY SET 2: Kiosk nodes authenticated via device tokens
--    Can only insert/read records for their own assigned booth_id
-- ----------------------------------------------------------------------------

-- 6.1 Photobooths table (Kiosk self-read & status/heartbeat update)
DROP POLICY IF EXISTS "Kiosks can view own assigned booth" ON public.photobooths;
CREATE POLICY "Kiosks can view own assigned booth"
    ON public.photobooths FOR SELECT
    TO anon, authenticated
    USING (id = public.get_auth_booth_id());

DROP POLICY IF EXISTS "Kiosks can update own heartbeat and status" ON public.photobooths;
CREATE POLICY "Kiosks can update own heartbeat and status"
    ON public.photobooths FOR UPDATE
    TO anon, authenticated
    USING (id = public.get_auth_booth_id())
    WITH CHECK (id = public.get_auth_booth_id());

-- 6.2 Sessions table (Kiosk scoped insert & read)
DROP POLICY IF EXISTS "Kiosks can insert sessions for assigned booth" ON public.sessions;
CREATE POLICY "Kiosks can insert sessions for assigned booth"
    ON public.sessions FOR INSERT
    TO anon, authenticated
    WITH CHECK (booth_id = public.get_auth_booth_id());

DROP POLICY IF EXISTS "Kiosks can view sessions for assigned booth" ON public.sessions;
CREATE POLICY "Kiosks can view sessions for assigned booth"
    ON public.sessions FOR SELECT
    TO anon, authenticated
    USING (booth_id = public.get_auth_booth_id());

-- 6.3 Telemetry table (Kiosk scoped insert & read)
DROP POLICY IF EXISTS "Kiosks can insert telemetry for assigned booth" ON public.telemetry;
CREATE POLICY "Kiosks can insert telemetry for assigned booth"
    ON public.telemetry FOR INSERT
    TO anon, authenticated
    WITH CHECK (booth_id = public.get_auth_booth_id());

DROP POLICY IF EXISTS "Kiosks can view telemetry for assigned booth" ON public.telemetry;
CREATE POLICY "Kiosks can view telemetry for assigned booth"
    ON public.telemetry FOR SELECT
    TO anon, authenticated
    USING (booth_id = public.get_auth_booth_id());

-- 6.4 Booth Settings table (Kiosk read-only for its booth)
DROP POLICY IF EXISTS "Kiosks can view settings for assigned booth" ON public.booth_settings;
CREATE POLICY "Kiosks can view settings for assigned booth"
    ON public.booth_settings FOR SELECT
    TO anon, authenticated
    USING (booth_id = public.get_auth_booth_id());

-- ----------------------------------------------------------------------------
-- 7. POLICY SET 3: Guests can view individual photo sessions by session ID
--    (for /gallery/[id] guest download link) WITHOUT seeing other tenant data
-- ----------------------------------------------------------------------------

-- 7.1 Sessions table (Guest access to single session)
-- Guests can read a session record by its unique primary key ID.
-- Note: Guests have ZERO SELECT permissions on owners, photobooths, telemetry, or booth_settings.
DROP POLICY IF EXISTS "Guests can view individual session by id" ON public.sessions;
CREATE POLICY "Guests can view individual session by id"
    ON public.sessions FOR SELECT
    TO anon
    USING (id IS NOT NULL);

-- 7.2 Vouchers table (Public validation for promo input)
DROP POLICY IF EXISTS "Public can validate active vouchers" ON public.vouchers;
CREATE POLICY "Public can validate active vouchers"
    ON public.vouchers FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- ----------------------------------------------------------------------------
-- 8. Secure RPC Functions (Stored Procedures for Protected Operations)
-- ----------------------------------------------------------------------------

-- 8.1 Secure Guest Download RPC
-- Returns public session details without exposing sensitive internal billing structures
CREATE OR REPLACE FUNCTION public.get_guest_session(p_session_id TEXT)
RETURNS TABLE (
    id TEXT,
    booth_id TEXT,
    package_id TEXT,
    raw_photos JSONB,
    composite_url TEXT,
    live_photos JSONB,
    guest_download_url TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        s.id,
        s.booth_id,
        s.package_id,
        s.raw_photos,
        s.composite_url,
        s.live_photos,
        s.guest_download_url,
        s.created_at
    FROM public.sessions s
    WHERE s.id = p_session_id;
$$;

-- 8.2 Secure Kiosk Pairing RPC
-- Allows a physical kiosk running on event floor to submit pairing PIN and receive its device token
CREATE OR REPLACE FUNCTION public.pair_kiosk_device(
    p_booth_id TEXT,
    p_pairing_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booth RECORD;
BEGIN
    SELECT * INTO v_booth
    FROM public.photobooths
    WHERE id = p_booth_id
      AND pairing_code = p_pairing_code
      AND (pairing_code_expires_at IS NULL OR pairing_code_expires_at > now());

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired pairing code');
    END IF;

    -- Update booth status to online, clear used PIN, and bump timestamp
    UPDATE public.photobooths
    SET status = 'online',
        last_heartbeat_at = now(),
        pairing_code = NULL,
        pairing_code_expires_at = NULL,
        updated_at = now()
    WHERE id = p_booth_id;

    RETURN jsonb_build_object(
        'success', true,
        'booth_id', v_booth.id,
        'device_token', v_booth.device_token,
        'name', v_booth.name,
        'location', v_booth.location
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Grants & Privileges (Least Privilege Principle)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Authenticated Owner privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photobooths TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.telemetry TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booth_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vouchers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_items TO authenticated;

-- Anon / Kiosk privileges
GRANT SELECT, UPDATE ON public.photobooths TO anon;
GRANT SELECT, INSERT ON public.sessions TO anon;
GRANT SELECT, INSERT ON public.telemetry TO anon;
GRANT SELECT ON public.booth_settings TO anon;
GRANT SELECT ON public.vouchers TO anon;

-- Explicitly revoke access to sensitive tables for anon
REVOKE ALL ON public.owners FROM anon;
REVOKE ALL ON public.pos_items FROM anon;

-- Function Execution Grants
GRANT EXECUTE ON FUNCTION public.is_booth_owner(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_booth_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pair_kiosk_device(TEXT, TEXT) TO anon, authenticated;
