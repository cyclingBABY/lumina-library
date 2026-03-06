ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS shelf_location text,
ADD COLUMN IF NOT EXISTS barcode text,
ADD COLUMN IF NOT EXISTS digital_file_url text,
ADD COLUMN IF NOT EXISTS digital_file_type text;