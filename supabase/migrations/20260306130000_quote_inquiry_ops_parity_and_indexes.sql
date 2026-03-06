BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'external_quote_inquiry'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'external_quote_inquiry'
        AND column_name = 'owner_user_id'
    ) THEN
      ALTER TABLE public.external_quote_inquiry
        ADD COLUMN owner_user_id uuid;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_external_quote_inquiry_owner_user_id
      ON public.external_quote_inquiry (owner_user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'international_quote_inquiry'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'international_quote_inquiry'
        AND column_name = 'owner_user_id'
    ) THEN
      ALTER TABLE public.international_quote_inquiry
        ADD COLUMN owner_user_id uuid;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'international_quote_inquiry'
        AND column_name = 'assigned_to'
    ) THEN
      ALTER TABLE public.international_quote_inquiry
        ADD COLUMN assigned_to uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'international_quote_inquiry'
        AND column_name = 'sales_stage'
    ) THEN
      ALTER TABLE public.international_quote_inquiry
        ADD COLUMN sales_stage text DEFAULT 'LEAD';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'international_quote_inquiry'
        AND column_name = 'expected_revenue'
    ) THEN
      ALTER TABLE public.international_quote_inquiry
        ADD COLUMN expected_revenue numeric(15, 2);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'international_quote_inquiry'
        AND column_name = 'win_probability'
    ) THEN
      ALTER TABLE public.international_quote_inquiry
        ADD COLUMN win_probability numeric(5, 2);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'international_quote_inquiry'
        AND column_name = 'lost_reason'
    ) THEN
      ALTER TABLE public.international_quote_inquiry
        ADD COLUMN lost_reason text;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'international_quote_inquiry'
        AND column_name = 'quote_file_url'
    ) THEN
      ALTER TABLE public.international_quote_inquiry
        ADD COLUMN quote_file_url text;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'international_quote_inquiry'
        AND column_name = 'quote_sent_at'
    ) THEN
      ALTER TABLE public.international_quote_inquiry
        ADD COLUMN quote_sent_at timestamptz;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'international_quote_inquiry'
        AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.international_quote_inquiry
        ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;

    ALTER TABLE public.international_quote_inquiry
      DROP CONSTRAINT IF EXISTS international_quote_inquiry_sales_stage_check;

    ALTER TABLE public.international_quote_inquiry
      ADD CONSTRAINT international_quote_inquiry_sales_stage_check
      CHECK (sales_stage IN ('LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'));

    CREATE INDEX IF NOT EXISTS idx_international_quote_inquiry_owner_user_id
      ON public.international_quote_inquiry (owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_international_quote_inquiry_assigned_to
      ON public.international_quote_inquiry (assigned_to);
    CREATE INDEX IF NOT EXISTS idx_international_quote_inquiry_sales_stage
      ON public.international_quote_inquiry (sales_stage);

    CREATE OR REPLACE FUNCTION public.update_international_quote_inquiry_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$;

    DROP TRIGGER IF EXISTS trigger_international_quote_inquiry_updated_at
      ON public.international_quote_inquiry;

    CREATE TRIGGER trigger_international_quote_inquiry_updated_at
      BEFORE UPDATE ON public.international_quote_inquiry
      FOR EACH ROW
      EXECUTE FUNCTION public.update_international_quote_inquiry_updated_at();
  END IF;
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
