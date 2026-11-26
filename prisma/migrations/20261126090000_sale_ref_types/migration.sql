-- The cylinder ledger names the sale module a movement belongs to. Domestic
-- sales and commercial invoices are numbered separately, so a shared "INVOICE"
-- made domestic sale #6 and commercial invoice #6 indistinguishable, and a
-- reversal of one voided the other's rows.
--
-- Its own migration: Postgres refuses to use a new enum value in the same
-- transaction that adds it, and the next migration uses both.
ALTER TYPE "ref_type" ADD VALUE IF NOT EXISTS 'DOMESTIC_SALE';
ALTER TYPE "ref_type" ADD VALUE IF NOT EXISTS 'COMMERCIAL_SALE';
