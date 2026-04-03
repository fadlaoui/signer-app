import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const BACKUP_FILE = path.join(DATA_DIR, "signatures_backup.json");
const DATA_FILE = path.join(DATA_DIR, "signatures.json");

export async function GET() {
  const file = fs.existsSync(BACKUP_FILE) ? BACKUP_FILE : DATA_FILE;
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return new NextResponse(raw, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="signatures-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch {
    return NextResponse.json([]);
  }
}
