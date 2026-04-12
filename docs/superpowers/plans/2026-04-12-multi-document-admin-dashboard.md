# Multi-Document Signing + Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the signer-app from a single-document signature collector into a multi-document platform with sidebar navigation and a Supabase-powered admin dashboard.

**Architecture:** Next.js 16 App Router with Supabase (PostgreSQL + Auth + Storage). Resident-facing sidebar lists open documents; admin dashboard behind Supabase Auth manages documents, signatures, stats, and exports. All data migrated from JSON files to Supabase.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Supabase (`@supabase/supabase-js` + `@supabase/ssr`), jsPDF, JSZip

---

## File Structure

```
src/
├── lib/
│   └── supabase/
│       ├── client.ts              — browser Supabase client
│       ├── server.ts              — server Supabase client
│       └── middleware.ts          — session refresh utility
├── app/
│   ├── layout.tsx                 — root layout (existing, modified)
│   ├── page.tsx                   — redirect to first open doc
│   ├── globals.css                — global styles (existing, modified)
│   ├── components/
│   │   ├── SignatureCanvas.tsx     — existing, unchanged
│   │   ├── Sidebar.tsx            — resident sidebar component
│   │   ├── AdminSidebar.tsx       — admin sidebar component
│   │   └── Toast.tsx              — shared toast component
│   ├── doc/
│   │   └── [id]/
│   │       └── page.tsx           — resident document view + sign
│   ├── admin/
│   │   ├── layout.tsx             — admin layout with auth guard
│   │   ├── page.tsx               — admin dashboard (stats)
│   │   ├── login/
│   │   │   └── page.tsx           — admin login page
│   │   ├── documents/
│   │   │   ├── page.tsx           — document list
│   │   │   ├── new/
│   │   │   │   └── page.tsx       — create document form
│   │   │   └── [id]/
│   │   │       └── page.tsx       — edit document + manage signatures
│   │   ├── accounts/
│   │   │   └── page.tsx           — manage admin accounts
│   │   └── export/
│   │       └── page.tsx           — bulk PDF export
│   └── api/
│       └── signatures/
│           ├── route.ts           — existing, will be replaced
│           └── backup/
│               └── route.ts       — existing, will be removed
├── middleware.ts                   — Next.js middleware (auth session refresh)
scripts/
└── migrate.ts                     — one-time JSON→Supabase migration
.env.local                         — Supabase credentials (gitignored)
```

---

### Task 1: Install Dependencies and Configure Supabase Client

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`
- Create: `.env.local`
- Modify: `.gitignore`

- [ ] **Step 1: Install Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Create `.env.local` with Supabase credentials**

Create `.env.local` at project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
```

The user must fill in their actual Supabase project values.

- [ ] **Step 3: Add `.env.local` to `.gitignore`**

Append to `.gitignore`:

```
.env.local
```

- [ ] **Step 4: Create browser client utility**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

- [ ] **Step 5: Create server client utility**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Cannot set cookies in Server Components
          }
        },
      },
    }
  );
}
```

- [ ] **Step 6: Create middleware session utility**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect admin routes (except login)
  if (
    !user &&
    request.nextUrl.pathname.startsWith("/admin") &&
    !request.nextUrl.pathname.startsWith("/admin/login")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from login page
  if (user && request.nextUrl.pathname === "/admin/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 7: Create Next.js middleware**

Create `src/middleware.ts`:

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts .gitignore
git commit -m "feat: add Supabase client setup and auth middleware"
```

---

### Task 2: Set Up Supabase Database Schema

**Files:**
- Create: `supabase/schema.sql`

This SQL runs in the Supabase SQL Editor (Dashboard → SQL Editor). It creates the tables, RLS policies, and storage bucket.

- [ ] **Step 1: Create the schema SQL file**

Create `supabase/schema.sql`:

```sql
-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signatures table
CREATE TABLE signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  appartement TEXT NOT NULL,
  signature_data TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signatures_document_id ON signatures(document_id);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

-- Documents policies
CREATE POLICY "Anyone can read open documents"
  ON documents FOR SELECT
  USING (status = 'open' OR auth.role() = 'authenticated');

CREATE POLICY "Admins can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (true);

-- Signatures policies
CREATE POLICY "Anyone can read signatures for open documents"
  ON signatures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = signatures.document_id
      AND (documents.status = 'open' OR auth.role() = 'authenticated')
    )
  );

CREATE POLICY "Anyone can sign open documents"
  ON signatures FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = signatures.document_id
      AND documents.status = 'open'
    )
  );

CREATE POLICY "Admins can update signatures"
  ON signatures FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete signatures"
  ON signatures FOR DELETE
  TO authenticated
  USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER signatures_updated_at
  BEFORE UPDATE ON signatures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read on attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');

CREATE POLICY "Admins can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Admins can delete attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');
```

- [ ] **Step 2: Run the SQL in Supabase Dashboard**

Go to your Supabase project → SQL Editor → paste the contents of `supabase/schema.sql` → Run.

- [ ] **Step 3: Create your first admin user**

In Supabase Dashboard → Authentication → Users → "Add user" → enter email + password. This is your admin account.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase database schema with RLS policies"
```

---

### Task 3: Create Shared UI Components (Toast, Sidebar, AdminSidebar)

**Files:**
- Create: `src/app/components/Toast.tsx`
- Create: `src/app/components/Sidebar.tsx`
- Create: `src/app/components/AdminSidebar.tsx`

- [ ] **Step 1: Create Toast component**

Extract the toast from the current monolithic page into a reusable component.

Create `src/app/components/Toast.tsx`:

```typescript
"use client";

export default function Toast({ message }: { message: string }) {
  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-xl transition-all duration-300 ${
        message ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
      } pointer-events-none z-50`}
    >
      {message}
    </div>
  );
}
```

- [ ] **Step 2: Create Sidebar component**

Create `src/app/components/Sidebar.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface DocItem {
  id: string;
  title: string;
  status: string;
  signature_count: number;
}

export default function Sidebar({ documents }: { documents: DocItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const content = (
    <div className="h-full flex flex-col">
      <div className="font-bold text-lg mb-5 pb-3 border-b border-white/20 flex items-center justify-between">
        <span>Documents</span>
        <button
          onClick={() => setOpen(false)}
          className="sm:hidden text-white/60 hover:text-white p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {documents.map((doc) => {
          const isActive = pathname === `/doc/${doc.id}`;
          return (
            <Link
              key={doc.id}
              href={`/doc/${doc.id}`}
              onClick={() => setOpen(false)}
              className={`block rounded-lg p-3 transition-colors ${
                isActive
                  ? "bg-white/15 border-l-[3px] border-indigo-300"
                  : "bg-white/5 border-l-[3px] border-transparent hover:bg-white/10"
              }`}
            >
              <div className="text-[13px] font-semibold truncate">{doc.title}</div>
              <div className="text-[11px] opacity-70 mt-1">
                {doc.status === "open" ? "🟢 Ouvert" : "🔴 Fermé"} · {doc.signature_count} signature{doc.signature_count !== 1 ? "s" : ""}
              </div>
            </Link>
          );
        })}
        {documents.length === 0 && (
          <p className="text-sm opacity-50 text-center py-8">Aucun document</p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden fixed top-3 left-3 z-40 bg-indigo-700 text-white p-2 rounded-lg shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-indigo-900 text-white p-4 shadow-2xl">
            {content}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden sm:block w-[260px] bg-indigo-900 text-white p-4 flex-shrink-0 h-screen sticky top-0 overflow-y-auto">
        {content}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Create AdminSidebar component**

Create `src/app/components/AdminSidebar.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Tableau de bord", icon: "📊" },
  { href: "/admin/documents", label: "Documents", icon: "📄" },
  { href: "/admin/accounts", label: "Comptes admin", icon: "👥" },
  { href: "/admin/export", label: "Export", icon: "📦" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  const content = (
    <div className="h-full flex flex-col">
      <div className="font-bold text-base mb-5 pb-3 border-b border-white/20 flex items-center justify-between">
        <span>Admin</span>
        <button
          onClick={() => setOpen(false)}
          className="sm:hidden text-white/60 hover:text-white p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2.5 text-[13px] transition-colors ${
                isActive ? "bg-white/10 font-medium" : "opacity-70 hover:opacity-100 hover:bg-white/5"
              }`}
            >
              {item.icon} {item.label}
            </Link>
          );
        })}
      </div>
      <div className="pt-4 border-t border-white/20 mt-4 space-y-2">
        <Link
          href="/"
          className="block text-[12px] opacity-60 hover:opacity-100 transition-opacity"
        >
          ← Retour au site
        </Link>
        <button
          onClick={handleLogout}
          className="block text-[12px] text-red-300 hover:text-red-200 transition-colors cursor-pointer"
        >
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden fixed top-3 left-3 z-40 bg-gray-800 text-white p-2 rounded-lg shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[220px] bg-gray-900 text-white p-4 shadow-2xl">
            {content}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden sm:block w-[220px] bg-gray-900 text-white p-4 flex-shrink-0 h-screen sticky top-0 overflow-y-auto">
        {content}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/Toast.tsx src/app/components/Sidebar.tsx src/app/components/AdminSidebar.tsx
git commit -m "feat: add Toast, Sidebar, and AdminSidebar components"
```

---

### Task 4: Build Resident Document View (`/doc/[id]`)

**Files:**
- Create: `src/app/doc/[id]/page.tsx`
- Modify: `src/app/page.tsx` — replace with redirect logic
- Modify: `src/app/layout.tsx` — update metadata

- [ ] **Step 1: Create resident document page**

Create `src/app/doc/[id]/page.tsx`:

```typescript
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { jsPDF } from "jspdf";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/app/components/Sidebar";
import Toast from "@/app/components/Toast";

const SignatureCanvas = dynamic(() => import("@/app/components/SignatureCanvas"), { ssr: false });

interface Document {
  id: string;
  title: string;
  body: string;
  status: string;
  attachments: string[];
}

interface Signature {
  id: string;
  document_id: string;
  nom: string;
  appartement: string;
  signature_data: string;
  date: string;
}

interface DocItem {
  id: string;
  title: string;
  status: string;
  signature_count: number;
}

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [document, setDocument] = useState<Document | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [nom, setNom] = useState("");
  const [appartement, setAppartement] = useState("");
  const [hasSig, setHasSig] = useState(false);
  const [toast, setToast] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const fetchDocuments = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("id, title, status")
      .in("status", ["open"])
      .order("created_at", { ascending: false });

    if (data) {
      // Get signature counts
      const docsWithCounts: DocItem[] = await Promise.all(
        data.map(async (doc) => {
          const { count } = await supabase
            .from("signatures")
            .select("*", { count: "exact", head: true })
            .eq("document_id", doc.id);
          return { ...doc, signature_count: count ?? 0 };
        })
      );
      setDocuments(docsWithCounts);
    }
  }, [supabase]);

  const fetchDocument = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();
    if (data) setDocument(data);
  }, [supabase, id]);

  const fetchSignatures = useCallback(async () => {
    const { data } = await supabase
      .from("signatures")
      .select("*")
      .eq("document_id", id)
      .order("created_at", { ascending: true });
    if (data) setSignatures(data);
  }, [supabase, id]);

  useEffect(() => {
    setMounted(true);
    fetchDocuments();
    fetchDocument();
    fetchSignatures();
  }, [fetchDocuments, fetchDocument, fetchSignatures]);

  function handleSignatureChange(has: boolean, canvas: HTMLCanvasElement | null) {
    setHasSig(has);
    canvasRef.current = canvas;
  }

  async function addSignature() {
    if (!nom.trim()) { showToast("Entrez votre nom"); return; }
    if (!appartement.trim()) { showToast("Entrez votre appartement"); return; }
    if (!hasSig || !canvasRef.current) { showToast("Signez d'abord"); return; }

    setSubmitting(true);
    const sigData = canvasRef.current.toDataURL("image/png");

    const { error } = await supabase.from("signatures").insert({
      document_id: id,
      nom: nom.trim(),
      appartement: appartement.trim(),
      signature_data: sigData,
      date: new Date().toLocaleDateString("fr-FR"),
    });

    if (!error) {
      await fetchSignatures();
      await fetchDocuments();
      setNom("");
      setAppartement("");
      setHasSig(false);
      canvasRef.current = null;
      showToast("Signature ajoutée");
    } else {
      showToast("Erreur lors de l'envoi");
    }
    setSubmitting(false);
  }

  function generatePDF() {
    if (!document || signatures.length === 0) { showToast("Aucune signature"); return; }

    const doc = new jsPDF("p", "mm", "a4");
    const W = 210;
    const mL = 22;
    const mR = 22;
    const cW = W - mL - mR;
    let y = 22;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 17, 17);
    const title = doc.splitTextToSize("Objet : " + document.title, cW);
    doc.text(title, W / 2, y, { align: "center" });
    y += title.length * 6 + 8;

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(mL, y, W - mR, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);

    const paras = document.body.split("\n");
    for (const p of paras) {
      if (p === "") { y += 3; continue; }
      const lines = doc.splitTextToSize(p, cW);
      if (y + lines.length * 4.5 > 280) { doc.addPage(); y = 22; }
      doc.text(lines, mL, y);
      y += lines.length * 4.5;
    }

    y += 10;
    doc.setDrawColor(220, 220, 220);
    doc.line(mL, y, W - mR, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("SIGNATURES DES COPROPRIÉTAIRES", mL, y);
    y += 6;

    const col1 = cW * 0.28;
    const col2 = cW * 0.14;
    const col3 = cW * 0.44;
    const col4 = cW * 0.14;
    const hH = 7;
    const rH = 10;

    function drawHeader(yy: number) {
      doc.setFillColor(245, 245, 245);
      doc.rect(mL, yy, cW, hH, "F");
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.15);
      doc.rect(mL, yy, col1, hH);
      doc.rect(mL + col1, yy, col2, hH);
      doc.rect(mL + col1 + col2, yy, col3, hH);
      doc.rect(mL + col1 + col2 + col3, yy, col4, hH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text("NOM", mL + 2, yy + 4.8);
      doc.text("APPT", mL + col1 + 2, yy + 4.8);
      doc.text("SIGNATURE", mL + col1 + col2 + 2, yy + 4.8);
      doc.text("DATE", mL + col1 + col2 + col3 + 2, yy + 4.8);
      return yy + hH;
    }

    y = drawHeader(y);

    for (const entry of signatures) {
      if (y + rH > 280) { doc.addPage(); y = 22; y = drawHeader(y); }
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.rect(mL, y, col1, rH);
      doc.rect(mL + col1, y, col2, rH);
      doc.rect(mL + col1 + col2, y, col3, rH);
      doc.rect(mL + col1 + col2 + col3, y, col4, rH);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(17, 17, 17);
      doc.text(entry.nom, mL + 2, y + rH / 2 + 1);

      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(entry.appartement, mL + col1 + 2, y + rH / 2 + 1);

      if (entry.signature_data !== "placeholder") {
        try {
          doc.addImage(entry.signature_data, "PNG", mL + col1 + col2 + 2, y + 1, col3 - 4, rH - 2);
        } catch { /* fallback */ }
      }

      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(entry.date, mL + col1 + col2 + col3 + 2, y + rH / 2 + 1);

      y += rH;
    }

    const filename = document.title.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s-]/g, "").replace(/\s+/g, "_");
    doc.save(`${filename}.pdf`);
    showToast("PDF téléchargé");
  }

  if (!mounted) {
    return (
      <div className="flex min-h-screen">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar documents={documents} />

      <div className="flex-1 min-w-0">
        {document ? (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">{document.title}</h1>
              <span
                className={`shrink-0 ml-3 text-[11px] font-semibold px-3 py-1 rounded-full ${
                  document.status === "open"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {document.status === "open" ? "Ouvert" : "Fermé"}
              </span>
            </div>

            {/* Letter body */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 mb-5 shadow-sm">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">Contenu</span>
              <div className="mt-3 text-sm leading-relaxed text-gray-600 space-y-3">
                {document.body.split("\n").map((line, i) =>
                  line.trim() === "" ? null : <p key={i}>{line}</p>
                )}
              </div>
              {document.attachments.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {document.attachments.map((path, i) => {
                    const filename = path.split("/").pop() || "fichier";
                    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attachments/${path}`;
                    return (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md hover:bg-indigo-100 transition-colors"
                      >
                        📎 {filename}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Signature form (only for open documents) */}
            {document.status === "open" && (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 sm:p-6 mb-5">
                <h2 className="text-base font-bold text-gray-900 mb-1">Ajouter votre signature</h2>
                <p className="text-xs text-gray-400 mb-5">Entrez vos informations et signez ci-dessous</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom complet</label>
                    <input
                      type="text"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      placeholder="Nom et Prénom"
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Appartement</label>
                    <input
                      type="text"
                      value={appartement}
                      onChange={(e) => setAppartement(e.target.value)}
                      placeholder="ex: B-12"
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                <label className="block text-xs font-medium text-gray-500 mb-1.5">Signature</label>
                <SignatureCanvas key={signatures.length} onSignatureChange={handleSignatureChange} />

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    onClick={addSignature}
                    disabled={submitting}
                    className="flex-1 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Envoi en cours..." : "Ajouter ma signature"}
                  </button>
                </div>
              </div>
            )}

            {/* Signatures list */}
            {signatures.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-5">
                <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">
                    Signatures
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-300">
                      {signatures.length} signature{signatures.length > 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={generatePDF}
                      className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium transition-colors cursor-pointer"
                    >
                      📥 PDF
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {signatures.map((entry) => (
                    <div key={entry.id} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="text-[13px] font-medium text-gray-800 truncate max-w-[140px]">{entry.nom}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">{entry.appartement}</span>
                      <div className="flex-1 min-w-0 flex items-center justify-center">
                        {entry.signature_data === "placeholder" ? (
                          <span className="text-[9px] italic text-gray-300">—</span>
                        ) : (
                          <img src={entry.signature_data} alt="" className="h-6 w-auto max-w-[80px] object-contain" />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-300 shrink-0">{entry.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center h-screen">
            <p className="text-sm text-gray-400">Document non trouvé</p>
          </div>
        )}
      </div>

      <Toast message={toast} />
    </div>
  );
}
```

- [ ] **Step 2: Replace root page with redirect**

Replace `src/app/page.tsx` entirely:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("documents")
    .select("id")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (data) {
    redirect(`/doc/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-800 mb-2">Aucun document disponible</h1>
        <p className="text-sm text-gray-500">Aucun document n&apos;est ouvert aux signatures pour le moment.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update root layout metadata**

Modify `src/app/layout.tsx` — update the metadata title and description:

```typescript
export const metadata: Metadata = {
  title: "Signatures — Copropriété",
  description: "Signez les documents de votre copropriété",
};
```

- [ ] **Step 4: Commit**

```bash
git add src/app/doc/ src/app/page.tsx src/app/layout.tsx
git commit -m "feat: add resident document view with sidebar and Supabase"
```

---

### Task 5: Build Admin Login Page

**Files:**
- Create: `src/app/admin/login/page.tsx`

- [ ] **Step 1: Create admin login page**

Create `src/app/admin/login/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
    } else {
      router.push("/admin");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Administration</h1>
        <p className="text-sm text-gray-500 text-center mb-8">Connectez-vous pour gérer les documents</p>

        <form onSubmit={handleLogin} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/login/
git commit -m "feat: add admin login page with Supabase Auth"
```

---

### Task 6: Build Admin Layout and Dashboard

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Create admin layout**

Create `src/app/admin/layout.tsx`:

```typescript
import AdminSidebar from "@/app/components/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
```

Note: the `/admin/login` page will also render inside this layout, but the middleware redirects logged-in users away from login, and the sidebar only shows when the admin is logged in — but since login also gets this layout, we need to exclude it. Instead, move the login page outside the layout by making the admin layout conditional.

Actually, let's handle this more cleanly: the login page should NOT have the admin sidebar. To achieve this in Next.js App Router, the login route group needs its own layout. Update approach:

Create `src/app/admin/layout.tsx`:

```typescript
"use client";

import { usePathname } from "next/navigation";
import AdminSidebar from "@/app/components/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create admin dashboard page**

Create `src/app/admin/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { count: totalDocs } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true });

  const { count: openDocs } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

  const { count: draftDocs } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("status", "draft");

  const { count: totalSigs } = await supabase
    .from("signatures")
    .select("*", { count: "exact", head: true });

  const stats = [
    { label: "Documents", value: totalDocs ?? 0, color: "text-gray-900" },
    { label: "Ouverts", value: openDocs ?? 0, color: "text-green-600" },
    { label: "Total signatures", value: totalSigs ?? 0, color: "text-indigo-600" },
    { label: "Brouillons", value: draftDocs ?? 0, color: "text-amber-600" },
  ];

  return (
    <div className="p-6 sm:p-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Tableau de bord</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">{stat.label}</div>
            <div className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx
git commit -m "feat: add admin layout and dashboard with stats"
```

---

### Task 7: Build Admin Document List and Create/Edit Pages

**Files:**
- Create: `src/app/admin/documents/page.tsx`
- Create: `src/app/admin/documents/new/page.tsx`
- Create: `src/app/admin/documents/[id]/page.tsx`

- [ ] **Step 1: Create document list page**

Create `src/app/admin/documents/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminDocuments() {
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  // Get signature counts for each document
  const docsWithCounts = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { count } = await supabase
        .from("signatures")
        .select("*", { count: "exact", head: true })
        .eq("document_id", doc.id);
      return { ...doc, signature_count: count ?? 0 };
    })
  );

  const statusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <span className="bg-green-100 text-green-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">Ouvert</span>;
      case "closed":
        return <span className="bg-red-100 text-red-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">Fermé</span>;
      default:
        return <span className="bg-amber-100 text-amber-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">Brouillon</span>;
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Documents</h1>
        <Link
          href="/admin/documents/new"
          className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          + Nouveau document
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_80px] px-5 py-3 bg-gray-50 text-[10px] font-semibold tracking-wider uppercase text-gray-400 border-b border-gray-100">
          <span>Titre</span>
          <span>Statut</span>
          <span>Signatures</span>
          <span>Créé le</span>
          <span>Actions</span>
        </div>
        {docsWithCounts.map((doc) => (
          <div
            key={doc.id}
            className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_80px] px-5 py-4 border-b border-gray-50 last:border-0 items-center gap-2 sm:gap-0"
          >
            <span className="font-medium text-[13px] text-gray-800">{doc.title}</span>
            <span>{statusBadge(doc.status)}</span>
            <span className="text-[13px] text-gray-500">{doc.signature_count}</span>
            <span className="text-[12px] text-gray-400">
              {new Date(doc.created_at).toLocaleDateString("fr-FR")}
            </span>
            <span className="flex gap-2">
              <Link href={`/admin/documents/${doc.id}`} className="text-indigo-500 hover:text-indigo-700 text-sm" title="Modifier">✏️</Link>
            </span>
          </div>
        ))}
        {docsWithCounts.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            Aucun document. Créez-en un pour commencer.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create new document page**

Create `src/app/admin/documents/new/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Toast from "@/app/components/Toast";

export default function NewDocument() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("draft");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const router = useRouter();
  const supabase = createClient();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { showToast("Le titre est requis"); return; }
    setLoading(true);

    // Create document
    const { data: doc, error } = await supabase
      .from("documents")
      .insert({ title: title.trim(), body, status })
      .select()
      .single();

    if (error || !doc) {
      showToast("Erreur lors de la création");
      setLoading(false);
      return;
    }

    // Upload attachments
    const attachmentPaths: string[] = [];
    for (const file of files) {
      const filePath = `${doc.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);
      if (!uploadError) {
        attachmentPaths.push(filePath);
      }
    }

    // Update document with attachment paths
    if (attachmentPaths.length > 0) {
      await supabase
        .from("documents")
        .update({ attachments: attachmentPaths })
        .eq("id", doc.id);
    }

    router.push("/admin/documents");
  }

  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Nouveau document</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Titre</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre du document"
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Contenu de la lettre</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder="Corps de la lettre..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm text-gray-800 leading-relaxed placeholder:text-gray-300 outline-none focus:border-indigo-500 transition-colors resize-y"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Statut</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:border-indigo-500 transition-colors bg-white"
          >
            <option value="draft">Brouillon</option>
            <option value="open">Ouvert aux signatures</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Pièces jointes</label>
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
          />
          {files.length > 0 && (
            <p className="text-[11px] text-gray-400 mt-1">{files.length} fichier{files.length > 1 ? "s" : ""} sélectionné{files.length > 1 ? "s" : ""}</p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Création..." : "Créer le document"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/documents")}
            className="py-3 px-6 border-2 border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:border-gray-300 transition-colors cursor-pointer"
          >
            Annuler
          </button>
        </div>
      </form>

      <Toast message={toast} />
    </div>
  );
}
```

- [ ] **Step 3: Create edit document page**

Create `src/app/admin/documents/[id]/page.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Toast from "@/app/components/Toast";

interface Document {
  id: string;
  title: string;
  body: string;
  status: string;
  attachments: string[];
  created_at: string;
}

interface Signature {
  id: string;
  nom: string;
  appartement: string;
  signature_data: string;
  date: string;
}

export default function EditDocument() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [doc, setDoc] = useState<Document | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("draft");
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const fetchDoc = useCallback(async () => {
    const { data } = await supabase.from("documents").select("*").eq("id", id).single();
    if (data) {
      setDoc(data);
      setTitle(data.title);
      setBody(data.body);
      setStatus(data.status);
    }
  }, [supabase, id]);

  const fetchSignatures = useCallback(async () => {
    const { data } = await supabase
      .from("signatures")
      .select("*")
      .eq("document_id", id)
      .order("created_at", { ascending: true });
    if (data) setSignatures(data);
  }, [supabase, id]);

  useEffect(() => {
    fetchDoc();
    fetchSignatures();
  }, [fetchDoc, fetchSignatures]);

  async function handleSave() {
    if (!title.trim()) { showToast("Le titre est requis"); return; }
    setLoading(true);

    // Upload new attachments
    const newPaths: string[] = [];
    for (const file of files) {
      const filePath = `${id}/${file.name}`;
      const { error } = await supabase.storage.from("attachments").upload(filePath, file);
      if (!error) newPaths.push(filePath);
    }

    const allAttachments = [...(doc?.attachments ?? []), ...newPaths];

    const { error } = await supabase
      .from("documents")
      .update({ title: title.trim(), body, status, attachments: allAttachments })
      .eq("id", id);

    if (error) {
      showToast("Erreur lors de la sauvegarde");
    } else {
      showToast("Document mis à jour");
      setFiles([]);
      fetchDoc();
    }
    setLoading(false);
  }

  async function handleDeleteSignature(sigId: string) {
    const { error } = await supabase.from("signatures").delete().eq("id", sigId);
    if (!error) {
      fetchSignatures();
      showToast("Signature supprimée");
    }
  }

  async function handleDeleteDocument() {
    if (!confirm("Supprimer ce document et toutes ses signatures ?")) return;
    await supabase.from("documents").delete().eq("id", id);
    router.push("/admin/documents");
  }

  async function handleRemoveAttachment(path: string) {
    if (!doc) return;
    await supabase.storage.from("attachments").remove([path]);
    const updated = doc.attachments.filter((p) => p !== path);
    await supabase.from("documents").update({ attachments: updated }).eq("id", id);
    fetchDoc();
    showToast("Pièce jointe supprimée");
  }

  if (!doc) {
    return <div className="p-8 text-gray-400 text-sm">Chargement...</div>;
  }

  return (
    <div className="p-6 sm:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Modifier le document</h1>
        <button
          onClick={handleDeleteDocument}
          className="text-[12px] text-red-400 hover:text-red-600 transition-colors cursor-pointer"
        >
          Supprimer le document
        </button>
      </div>

      {/* Edit form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Titre</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Contenu</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm text-gray-800 leading-relaxed outline-none focus:border-indigo-500 transition-colors resize-y"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Statut</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:border-indigo-500 transition-colors bg-white"
          >
            <option value="draft">Brouillon</option>
            <option value="open">Ouvert</option>
            <option value="closed">Fermé</option>
          </select>
        </div>

        {/* Existing attachments */}
        {doc.attachments.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Pièces jointes actuelles</label>
            <div className="flex flex-wrap gap-2">
              {doc.attachments.map((path, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-[11px] px-2.5 py-1 rounded-md">
                  <span>📎 {path.split("/").pop()}</span>
                  <button
                    onClick={() => handleRemoveAttachment(path)}
                    className="text-red-400 hover:text-red-600 ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New attachments */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Ajouter des pièces jointes</label>
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Sauvegarde..." : "Enregistrer les modifications"}
        </button>
      </div>

      {/* Signatures */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">Signatures</span>
          <span className="text-[11px] text-gray-300">{signatures.length} signature{signatures.length !== 1 ? "s" : ""}</span>
        </div>
        {signatures.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Aucune signature</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {signatures.map((sig) => (
              <div key={sig.id} className="px-4 py-3 flex items-center gap-3">
                <span className="text-[13px] font-medium text-gray-800 truncate max-w-[140px]">{sig.nom}</span>
                <span className="text-[11px] text-gray-400 shrink-0">{sig.appartement}</span>
                <div className="flex-1 min-w-0 flex items-center justify-center">
                  {sig.signature_data === "placeholder" ? (
                    <span className="text-[9px] italic text-gray-300">—</span>
                  ) : (
                    <img src={sig.signature_data} alt="" className="h-6 w-auto max-w-[80px] object-contain" />
                  )}
                </div>
                <span className="text-[10px] text-gray-300 shrink-0">{sig.date}</span>
                <button
                  onClick={() => handleDeleteSignature(sig.id)}
                  className="text-gray-300 hover:text-red-400 p-1 cursor-pointer shrink-0"
                  title="Supprimer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Toast message={toast} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/documents/
git commit -m "feat: add admin document list, create, and edit pages"
```

---

### Task 8: Build Admin Accounts Page

**Files:**
- Create: `src/app/admin/accounts/page.tsx`

- [ ] **Step 1: Create accounts management page**

Create `src/app/admin/accounts/page.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Toast from "@/app/components/Toast";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
}

export default function AdminAccounts() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const supabase = createClient();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const fetchUsers = useCallback(async () => {
    // List users via the admin API (requires service role — we use a server action instead)
    // For now, fetch from auth.getUser to show current user
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setUsers([
        {
          id: data.user.id,
          email: data.user.email ?? "",
          created_at: data.user.created_at,
        },
      ]);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast("Email et mot de passe requis");
      return;
    }
    setLoading(true);

    // Sign up a new user via the API
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    if (res.ok) {
      showToast("Administrateur ajouté");
      setEmail("");
      setPassword("");
    } else {
      const data = await res.json();
      showToast(data.error || "Erreur lors de l'invitation");
    }
    setLoading(false);
  }

  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Comptes administrateurs</h1>

      {/* Current users */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">Administrateurs</span>
        </div>
        {users.map((user) => (
          <div key={user.id} className="px-5 py-3 flex items-center justify-between border-b border-gray-50 last:border-0">
            <div>
              <span className="text-[13px] font-medium text-gray-800">{user.email}</span>
              <span className="text-[11px] text-gray-300 ml-3">
                Depuis le {new Date(user.created_at).toLocaleDateString("fr-FR")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Invite new admin */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-900 mb-4">Ajouter un administrateur</h2>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nouvel-admin@example.com"
              required
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Ajout..." : "Ajouter"}
          </button>
        </form>
      </div>

      <Toast message={toast} />
    </div>
  );
}
```

- [ ] **Step 2: Create admin invite API route**

Create `src/app/api/admin/invite/route.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Verify the requester is authenticated
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
  }

  // Use service role to create user
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/accounts/ src/app/api/admin/
git commit -m "feat: add admin accounts management with user invite"
```

---

### Task 9: Build Admin Export Page

**Files:**
- Create: `src/app/admin/export/page.tsx`

- [ ] **Step 1: Install JSZip**

```bash
npm install jszip
```

- [ ] **Step 2: Create export page**

Create `src/app/admin/export/page.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import Toast from "@/app/components/Toast";

interface Document {
  id: string;
  title: string;
  status: string;
  body: string;
}

interface Signature {
  nom: string;
  appartement: string;
  signature_data: string;
  date: string;
}

export default function AdminExport() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const supabase = createClient();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const fetchDocuments = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("id, title, status, body")
      .order("created_at", { ascending: false });
    if (data) setDocuments(data);
  }, [supabase]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === documents.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(documents.map((d) => d.id)));
    }
  }

  function generateDocPDF(doc: Document, signatures: Signature[]): jsPDF {
    const pdf = new jsPDF("p", "mm", "a4");
    const W = 210; const mL = 22; const mR = 22; const cW = W - mL - mR;
    let y = 22;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(17, 17, 17);
    const title = pdf.splitTextToSize("Objet : " + doc.title, cW);
    pdf.text(title, W / 2, y, { align: "center" });
    y += title.length * 6 + 8;

    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.2);
    pdf.line(mL, y, W - mR, y);
    y += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(50, 50, 50);

    for (const p of doc.body.split("\n")) {
      if (p === "") { y += 3; continue; }
      const lines = pdf.splitTextToSize(p, cW);
      if (y + lines.length * 4.5 > 280) { pdf.addPage(); y = 22; }
      pdf.text(lines, mL, y);
      y += lines.length * 4.5;
    }

    if (signatures.length > 0) {
      y += 10;
      pdf.setDrawColor(220, 220, 220);
      pdf.line(mL, y, W - mR, y);
      y += 6;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text("SIGNATURES DES COPROPRIÉTAIRES", mL, y);
      y += 6;

      const col1 = cW * 0.28; const col2 = cW * 0.14;
      const col3 = cW * 0.44; const col4 = cW * 0.14;
      const hH = 7; const rH = 10;

      function drawHeader(yy: number) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(mL, yy, cW, hH, "F");
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.15);
        pdf.rect(mL, yy, col1, hH);
        pdf.rect(mL + col1, yy, col2, hH);
        pdf.rect(mL + col1 + col2, yy, col3, hH);
        pdf.rect(mL + col1 + col2 + col3, yy, col4, hH);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text("NOM", mL + 2, yy + 4.8);
        pdf.text("APPT", mL + col1 + 2, yy + 4.8);
        pdf.text("SIGNATURE", mL + col1 + col2 + 2, yy + 4.8);
        pdf.text("DATE", mL + col1 + col2 + col3 + 2, yy + 4.8);
        return yy + hH;
      }

      y = drawHeader(y);

      for (const sig of signatures) {
        if (y + rH > 280) { pdf.addPage(); y = 22; y = drawHeader(y); }
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.1);
        pdf.rect(mL, y, col1, rH);
        pdf.rect(mL + col1, y, col2, rH);
        pdf.rect(mL + col1 + col2, y, col3, rH);
        pdf.rect(mL + col1 + col2 + col3, y, col4, rH);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(17, 17, 17);
        pdf.text(sig.nom, mL + 2, y + rH / 2 + 1);

        pdf.setFontSize(8);
        pdf.setTextColor(80, 80, 80);
        pdf.text(sig.appartement, mL + col1 + 2, y + rH / 2 + 1);

        if (sig.signature_data !== "placeholder") {
          try {
            pdf.addImage(sig.signature_data, "PNG", mL + col1 + col2 + 2, y + 1, col3 - 4, rH - 2);
          } catch { /* fallback */ }
        }

        pdf.setFontSize(7);
        pdf.setTextColor(120, 120, 120);
        pdf.text(sig.date, mL + col1 + col2 + col3 + 2, y + rH / 2 + 1);

        y += rH;
      }
    }

    return pdf;
  }

  async function handleExport() {
    if (selected.size === 0) { showToast("Sélectionnez au moins un document"); return; }
    setLoading(true);

    const zip = new JSZip();

    for (const docId of selected) {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) continue;

      const { data: sigs } = await supabase
        .from("signatures")
        .select("nom, appartement, signature_data, date")
        .eq("document_id", docId)
        .order("created_at", { ascending: true });

      const pdf = generateDocPDF(doc, sigs ?? []);
      const filename = doc.title.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s-]/g, "").replace(/\s+/g, "_");

      if (selected.size === 1) {
        // Single doc: download directly
        pdf.save(`${filename}.pdf`);
        setLoading(false);
        showToast("PDF téléchargé");
        return;
      }

      zip.file(`${filename}.pdf`, pdf.output("arraybuffer"));
    }

    // Multiple docs: download as ZIP
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_documents_${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    setLoading(false);
    showToast("Export terminé");
  }

  const statusLabel: Record<string, string> = { draft: "Brouillon", open: "Ouvert", closed: "Fermé" };

  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Export PDF</h1>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">Sélectionnez les documents</span>
          <button onClick={selectAll} className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium cursor-pointer">
            {selected.size === documents.length ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        </div>
        {documents.map((doc) => (
          <label
            key={doc.id}
            className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.has(doc.id)}
              onChange={() => toggleSelect(doc.id)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-[13px] font-medium text-gray-800 flex-1">{doc.title}</span>
            <span className="text-[11px] text-gray-400">{statusLabel[doc.status] ?? doc.status}</span>
          </label>
        ))}
        {documents.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Aucun document</div>
        )}
      </div>

      <button
        onClick={handleExport}
        disabled={loading || selected.size === 0}
        className="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Export en cours..." : `Exporter ${selected.size} document${selected.size > 1 ? "s" : ""}`}
      </button>

      <Toast message={toast} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/export/
git commit -m "feat: add admin bulk PDF export with ZIP download"
```

---

### Task 10: Create Migration Script and Clean Up Old Code

**Files:**
- Create: `scripts/migrate.ts`
- Remove: `src/app/api/signatures/route.ts` (old file-based API)
- Remove: `src/app/api/signatures/backup/route.ts`

- [ ] **Step 1: Create migration script**

Create `scripts/migrate.ts`:

```typescript
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

  // Create the first document
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

  // Insert signatures
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
```

- [ ] **Step 2: Run the migration**

```bash
npx tsx scripts/migrate.ts
```

Expected output:
```
Reading signatures.json...
Found 20 signatures to migrate.
Creating document...
Document created: <uuid>
Migrated 20 signatures successfully.
Migration complete!
```

- [ ] **Step 3: Remove old file-based API routes**

Delete `src/app/api/signatures/route.ts` and `src/app/api/signatures/backup/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate.ts
git rm src/app/api/signatures/route.ts src/app/api/signatures/backup/route.ts
git commit -m "feat: add migration script, remove old file-based API"
```

---

### Task 11: Verify and Test Locally

- [ ] **Step 1: Ensure `.env.local` has valid Supabase credentials**

Verify the file exists and has real values (not placeholder).

- [ ] **Step 2: Run the Supabase schema SQL**

Open Supabase Dashboard → SQL Editor → paste `supabase/schema.sql` → Run.

- [ ] **Step 3: Create the first admin user**

Supabase Dashboard → Authentication → Users → Add user (email + password).

- [ ] **Step 4: Run the migration**

```bash
npx tsx scripts/migrate.ts
```

- [ ] **Step 5: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 6: Test resident view**

Open `http://localhost:3000`. Should redirect to the first open document. Verify:
- Sidebar shows the migrated document
- Letter body displays correctly
- Can add a new signature (name, apartment, canvas)
- PDF download works

- [ ] **Step 7: Test admin login**

Navigate to `/admin/login`. Log in with the admin credentials. Should redirect to `/admin`.

- [ ] **Step 8: Test admin dashboard**

Verify stats cards show correct counts (1 document, 20 signatures, etc.).

- [ ] **Step 9: Test admin document management**

- Create a new document via `/admin/documents/new`
- Edit the document via `/admin/documents/[id]`
- Change status from draft → open
- Verify it appears in the resident sidebar

- [ ] **Step 10: Test admin export**

- Go to `/admin/export`
- Select documents and export
- Verify PDF content

- [ ] **Step 11: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during testing"
```
