import "dotenv/config";
import { Client } from "pg";

const DIRECT_URL = process.env.DIRECT_URL;

if (!DIRECT_URL) {
  console.error("Missing DIRECT_URL in .env");
  process.exit(1);
}

const sql = `
-- Restore Supabase default grants (needed after prisma db push --force-reset)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

-- Documents policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read open documents' AND tablename = 'documents') THEN
    CREATE POLICY "Anyone can read open documents"
      ON documents FOR SELECT
      USING (status = 'open' OR auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can insert documents' AND tablename = 'documents') THEN
    CREATE POLICY "Admins can insert documents"
      ON documents FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update documents' AND tablename = 'documents') THEN
    CREATE POLICY "Admins can update documents"
      ON documents FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete documents' AND tablename = 'documents') THEN
    CREATE POLICY "Admins can delete documents"
      ON documents FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Signatures policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read signatures for open documents' AND tablename = 'signatures') THEN
    CREATE POLICY "Anyone can read signatures for open documents"
      ON signatures FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM documents
          WHERE documents.id = signatures.document_id
          AND (documents.status = 'open' OR auth.role() = 'authenticated')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can sign open documents' AND tablename = 'signatures') THEN
    CREATE POLICY "Anyone can sign open documents"
      ON signatures FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM documents
          WHERE documents.id = signatures.document_id
          AND documents.status = 'open'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update signatures' AND tablename = 'signatures') THEN
    CREATE POLICY "Admins can update signatures"
      ON signatures FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete signatures' AND tablename = 'signatures') THEN
    CREATE POLICY "Admins can delete signatures"
      ON signatures FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'documents_updated_at') THEN
    CREATE TRIGGER documents_updated_at
      BEFORE UPDATE ON documents
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'signatures_updated_at') THEN
    CREATE TRIGGER signatures_updated_at
      BEFORE UPDATE ON signatures
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read on attachments' AND tablename = 'objects') THEN
    CREATE POLICY "Public read on attachments"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'attachments');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can upload attachments' AND tablename = 'objects') THEN
    CREATE POLICY "Admins can upload attachments"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'attachments');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete attachments' AND tablename = 'objects') THEN
    CREATE POLICY "Admins can delete attachments"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'attachments');
  END IF;
END $$;
`;

async function main() {
  console.log("Connecting to database...");
  const client = new Client({ connectionString: DIRECT_URL });
  await client.connect();

  console.log("Applying RLS policies, triggers, and storage bucket...");
  await client.query(sql);
  console.log("Done!");

  await client.end();
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
