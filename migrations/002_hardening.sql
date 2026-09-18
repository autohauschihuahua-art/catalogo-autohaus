-- ========================================================
-- AUTOHAUS ENTERPRISE HARDENING & INTEGRITY MIGRATION
-- ========================================================

-- 1. SOFT DELETE & VIN COLUMNS IN VEHICLES
ALTER TABLE public.vehicles 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vin TEXT;

-- Populate default is_active for any existing records
UPDATE public.vehicles SET is_active = true WHERE is_active IS NULL;

-- Ensure UNIQUE constraint on VIN (allows multiple NULLs in Postgres)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_vin_unique'
  ) THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_vin_unique UNIQUE (vin);
  END IF;
END $$;

-- 2. CONSISTENT STATUS CHECK CONSTRAINT
-- First, ensure all existing records have compliant status
UPDATE public.vehicles 
SET status = 'disponible' 
WHERE status NOT IN ('disponible', 'apartado', 'en_preparacion', 'vendido', 'baja') OR status IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_status_check') THEN
    ALTER TABLE public.vehicles DROP CONSTRAINT vehicles_status_check;
  END IF;
  ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_status_check 
    CHECK (status IN ('disponible', 'apartado', 'en_preparacion', 'vendido', 'baja'));
END $$;

-- 3. AUDIT TIMESTAMPS & TRIGGERS
ALTER TABLE public.vehicle_status_history 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_status_history_updated_at ON public.vehicle_status_history;
CREATE TRIGGER trg_status_history_updated_at
  BEFORE UPDATE ON public.vehicle_status_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_favorites ENABLE ROW LEVEL SECURITY;

-- Clean existing policies to rebuild strict rules
DROP POLICY IF EXISTS "Public read branches" ON public.branches;
DROP POLICY IF EXISTS "Service full branches" ON public.branches;
DROP POLICY IF EXISTS "Public read users" ON public.users;
DROP POLICY IF EXISTS "Service full users" ON public.users;
DROP POLICY IF EXISTS "Public read sales_reps" ON public.sales_reps;
DROP POLICY IF EXISTS "Service full sales_reps" ON public.sales_reps;
DROP POLICY IF EXISTS "Public read clients" ON public.clients;
DROP POLICY IF EXISTS "Service full clients" ON public.clients;
DROP POLICY IF EXISTS "Public read vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Public read active vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Service full vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Public read status_history" ON public.vehicle_status_history;
DROP POLICY IF EXISTS "Service full status_history" ON public.vehicle_status_history;
DROP POLICY IF EXISTS "Public read leads" ON public.leads;
DROP POLICY IF EXISTS "Service full leads" ON public.leads;
DROP POLICY IF EXISTS "Public read client_favorites" ON public.client_favorites;
DROP POLICY IF EXISTS "Service full client_favorites" ON public.client_favorites;
DROP POLICY IF EXISTS "Public insert leads" ON public.leads;

-- Branches & Sales Reps: Public read, Service Full
CREATE POLICY "Public read branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Service full branches" ON public.branches FOR ALL USING (true);

CREATE POLICY "Public read sales_reps" ON public.sales_reps FOR SELECT USING (true);
CREATE POLICY "Service full sales_reps" ON public.sales_reps FOR ALL USING (true);

-- Vehicles: Public can only view active non-deleted vehicles. Service/Auth has full access.
CREATE POLICY "Public read active vehicles" ON public.vehicles FOR SELECT USING (is_active = true AND deleted_at IS NULL);
CREATE POLICY "Service full vehicles" ON public.vehicles FOR ALL USING (true);

-- Vehicle Status History: Authenticated and Service Full
CREATE POLICY "Public read status_history" ON public.vehicle_status_history FOR SELECT USING (true);
CREATE POLICY "Service full status_history" ON public.vehicle_status_history FOR ALL USING (true);

-- Leads: Public can insert new leads; only authenticated/service can read and update
CREATE POLICY "Public insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Service full leads" ON public.leads FOR ALL USING (true);

-- Users & Clients: Service role and Authenticated Full access
CREATE POLICY "Service full users" ON public.users FOR ALL USING (true);
CREATE POLICY "Service full clients" ON public.clients FOR ALL USING (true);
CREATE POLICY "Service full client_favorites" ON public.client_favorites FOR ALL USING (true);
