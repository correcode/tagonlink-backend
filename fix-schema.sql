ALTER TABLE links ADD COLUMN IF NOT EXISTS user_id INTEGER;

ALTER TABLE links 
  ADD CONSTRAINT IF NOT EXISTS links_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);

