-- Customers: duplicate phones allowed per warehouse; phone/mobile optional.
-- Removes warehouse+phone uniqueness (blocks real-world CSVs where many parties share one number).

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_unique_phone_per_warehouse;

ALTER TABLE public.customers
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN mobile DROP NOT NULL;
