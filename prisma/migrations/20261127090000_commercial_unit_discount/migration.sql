-- A commercial invoice's discount is now per cylinder. The rate is kept beside
-- the amount it came to; older invoices keep their flat discount and a null rate.
ALTER TABLE "commercial_sales" ADD COLUMN "unit_discount" DECIMAL(10,2);
