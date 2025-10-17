-- Add Amazon purchase metadata columns to shopping list items
ALTER TABLE IF EXISTS public.shopping_list_items
ADD COLUMN IF NOT EXISTS amazon_asin TEXT,
ADD COLUMN IF NOT EXISTS amazon_product_url TEXT,
ADD COLUMN IF NOT EXISTS amazon_is_subscription BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS amazon_recurring_interval_days INTEGER,
ADD COLUMN IF NOT EXISTS amazon_last_purchased_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS amazon_next_delivery_at TIMESTAMPTZ;

