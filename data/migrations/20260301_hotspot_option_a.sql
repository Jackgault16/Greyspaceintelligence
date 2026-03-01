DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brief_document_pins'
  ) THEN
    CREATE TABLE public.brief_document_pins (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      brief_id uuid NOT NULL REFERENCES public.brief_documents(id) ON DELETE CASCADE,

      label text,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,

      region text,
      category text,
      risk_level text CHECK (risk_level IN ('low','medium','high')),

      event_id uuid,

      -- Option A structured writing:
      hotspot_summary text,
      hotspot_why_it_matters text,
      hotspot_indicators text[] NOT NULL DEFAULT '{}',
      hotspot_sources text[] NOT NULL DEFAULT '{}',

      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_brief_document_pins_brief ON public.brief_document_pins (brief_id);

    ALTER TABLE public.brief_document_pins ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "brief_document_pins_public_read" ON public.brief_document_pins;
    CREATE POLICY "brief_document_pins_public_read"
    ON public.brief_document_pins
    FOR SELECT
    USING (true);

    DROP POLICY IF EXISTS "brief_document_pins_admin_write" ON public.brief_document_pins;
    CREATE POLICY "brief_document_pins_admin_write"
    ON public.brief_document_pins
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

  END IF;
END $$;

-- Add missing columns if table exists
ALTER TABLE public.brief_document_pins
  ADD COLUMN IF NOT EXISTS hotspot_summary text;

ALTER TABLE public.brief_document_pins
  ADD COLUMN IF NOT EXISTS hotspot_why_it_matters text;

ALTER TABLE public.brief_document_pins
  ADD COLUMN IF NOT EXISTS hotspot_indicators text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.brief_document_pins
  ADD COLUMN IF NOT EXISTS hotspot_sources text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.brief_document_pins
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- updated_at trigger (reuse existing set_updated_at if present, else create)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at' AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_brief_document_pins_updated_at ON public.brief_document_pins;
CREATE TRIGGER trg_brief_document_pins_updated_at
BEFORE UPDATE ON public.brief_document_pins
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
