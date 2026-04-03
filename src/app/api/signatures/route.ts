import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "signatures.json");
const BACKUP_FILE = path.join(DATA_DIR, "signatures_backup.json");

// Auto-backup every 10 minutes
const g = globalThis as unknown as Record<string, unknown>;
if (!g.__backupInterval) {
  g.__backupInterval = setInterval(() => {
    try {
      if (fs.existsSync(DATA_FILE)) {
        fs.copyFileSync(DATA_FILE, BACKUP_FILE);
      }
    } catch { /* ignore */ }
  }, 10 * 60 * 1000);
}

interface SignEntry {
  id: string;
  nom: string;
  appartement: string;
  signatureData: string;
  date: string;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readData(): SignEntry[] {
  try {
    ensureDataDir();
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeData(entries: SignEntry[]) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export async function GET() {
  const entries = readData();
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nom, appartement, signatureData, date } = body;

  if (!nom || !appartement || !signatureData) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const entry: SignEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nom,
    appartement,
    signatureData,
    date: date || new Date().toLocaleDateString("fr-FR"),
  };

  const entries = readData();
  entries.push(entry);
  writeData(entries);

  return NextResponse.json(entry, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, nom, appartement, signatureData } = body;

  if (!id || !nom || !appartement || !signatureData) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const entries = readData();
  const index = entries.findIndex((e) => e.id === id);

  if (index === -1) {
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  }

  entries[index] = {
    ...entries[index],
    nom,
    appartement,
    signatureData,
    date: new Date().toLocaleDateString("fr-FR"),
  };

  writeData(entries);
  return NextResponse.json(entries[index]);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  const entries = readData();
  const filtered = entries.filter((e) => e.id !== id);

  if (filtered.length === entries.length) {
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  }

  writeData(filtered);
  return NextResponse.json({ ok: true });
}

