import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LETTER_TITLE = "Demande urgente de dératisation — copropriété";
const LETTER_BODY = `Monsieur,

Nous, copropriétaires de l'immeuble, souhaitons vous alerter sur la présence de rats et de souris constatée dans les parties communes. Plusieurs résidents ont signalé ces nuisibles et un rat a même été retrouvé récemment, ce qui confirme la gravité de la situation.

Il s'agit d'un problème sérieux d'hygiène et de salubrité qui nécessite une prise en charge immédiate. Nous vous demandons donc d'organiser en urgence une dératisation complète de l'immeuble ainsi qu'un contrôle des parties communes afin d'identifier l'origine du problème.

Dans l'attente de votre retour rapide sur les mesures mises en place.

Les copropriétaires`;

async function migrate() {
  console.log("Reading signatures.json...");
  const dataPath = path.join(process.cwd(), "data", "signatures.json");

  if (!fs.existsSync(dataPath)) {
    console.error("data/signatures.json not found");
    process.exit(1);
  }

  const entries = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  console.log(`Found ${entries.length} signatures to migrate.`);

  console.log("Creating document...");
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      title: LETTER_TITLE,
      body: LETTER_BODY,
      status: "open",
      attachments: [],
    })
    .select()
    .single();

  if (docError || !doc) {
    console.error("Failed to create document:", docError);
    process.exit(1);
  }
  console.log(`Document created: ${doc.id}`);

  const signatures = entries.map((entry: { nom: string; appartement: string; signatureData: string; date: string }) => ({
    document_id: doc.id,
    nom: entry.nom,
    appartement: entry.appartement,
    signature_data: entry.signatureData,
    date: entry.date,
  }));

  const { error: sigError } = await supabase.from("signatures").insert(signatures);

  if (sigError) {
    console.error("Failed to insert signatures:", sigError);
    process.exit(1);
  }

  console.log(`Migrated ${signatures.length} signatures successfully.`);
  console.log("Migration complete!");
}

migrate();
