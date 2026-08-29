ALTER TABLE products
ADD COLUMN IF NOT EXISTS original_price NUMERIC(12,2);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS offer_active BOOLEAN DEFAULT FALSE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS offer_percent NUMERIC(5,2) DEFAULT 0;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS offer_price NUMERIC(12,2);

UPDATE products
SET original_price = COALESCE(original_price, price),
    offer_active = COALESCE(offer_active, FALSE),
    offer_percent = COALESCE(offer_percent, 0)
WHERE original_price IS NULL
   OR offer_active IS NULL
   OR offer_percent IS NULL;
