import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DIRECT_URL = process.env.DIRECT_URL;

// Use pg for direct insert since we don't need Supabase auth for seeding
import { Client } from "pg";

if (!DIRECT_URL) {
  console.error("Missing DIRECT_URL in .env");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DIRECT_URL });
  await client.connect();

  // Check if data already exists
  const { rows } = await client.query("SELECT count(*) as c FROM documents");
  if (parseInt(rows[0].c) > 0) {
    console.log(`Database already has documents — skipping seed.`);
    await client.end();
    return;
  }

  // Check for existing signatures file
  const dataPath = path.join(process.cwd(), "data", "signatures.json");
  if (!fs.existsSync(dataPath)) {
    console.log("No data/signatures.json found — skipping seed.");
    await client.end();
    return;
  }

  const entries = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  console.log(`Found ${entries.length} signatures to import.`);

  // Create document
  const docResult = await client.query(
    `INSERT INTO documents (title, body, status, attachments)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      "Demande urgente de dératisation — copropriété",
      `Monsieur,

Nous, copropriétaires de l'immeuble, souhaitons vous alerter sur la présence de rats et de souris constatée dans les parties communes. Plusieurs résidents ont signalé ces nuisibles et un rat a même été retrouvé récemment, ce qui confirme la gravité de la situation.

Il s'agit d'un problème sérieux d'hygiène et de salubrité qui nécessite une prise en charge immédiate. Nous vous demandons donc d'organiser en urgence une dératisation complète de l'immeuble ainsi qu'un contrôle des parties communes afin d'identifier l'origine du problème.

Dans l'attente de votre retour rapide sur les mesures mises en place.

Les copropriétaires`,
      "open",
      "[]",
    ]
  );

  const docId = docResult.rows[0].id;
  console.log(`Document created: ${docId}`);

  // Insert signatures
  for (const entry of entries) {
    await client.query(
      `INSERT INTO signatures (document_id, nom, appartement, signature_data, date)
       VALUES ($1, $2, $3, $4, $5)`,
      [docId, entry.nom, entry.appartement, entry.signatureData, entry.date]
    );
  }

  console.log(`Imported ${entries.length} signatures.`);
  await client.end();
}

main()
  .then(() => console.log("Seed complete!"))
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  });
