CREATE TABLE public.delivery_inspections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 data jsonb NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_inspections TO authenticated;
GRANT ALL ON public.delivery_inspections TO service_role;
ALTER TABLE public.delivery_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read deliveries" ON public.delivery_inspections FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "Owners create deliveries" ON public.delivery_inspections FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY "Owners update deliveries" ON public.delivery_inspections FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY "Owners delete deliveries" ON public.delivery_inspections FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE INDEX delivery_inspections_owner_created ON public.delivery_inspections(owner_id, created_at DESC);