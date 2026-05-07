-- One transaction_charges row per lot + movement scope + product charge type + charge_date.
-- Partial indexes: PostgreSQL UNIQUE treats NULL as distinct, so split lodgement (delivery_id IS NULL) vs delivery.

CREATE UNIQUE INDEX IF NOT EXISTS transaction_charges_uniq_lot_inward_charge_date
  ON public.transaction_charges (lot_id, product_charge_type_id, charge_date)
  WHERE delivery_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transaction_charges_uniq_lot_delivery_charge_date
  ON public.transaction_charges (lot_id, delivery_id, product_charge_type_id, charge_date)
  WHERE delivery_id IS NOT NULL;
