# Multi-Document Signing + Admin Dashboard — Design Spec

## Overview

Transform the signer-app from a single-document signature collector into a multi-document platform with an admin dashboard. Documents are managed by authenticated admins, and residents browse/sign documents via a sidebar navigation.

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS 4 (existing)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **New dependency**: `@supabase/supabase-js` + `@supabase/ssr`
- **PDF generation**: jsPDF (existing)

## Database Schema (Supabase PostgreSQL)

### `documents` table

| Column       | Type        | Notes                                  |
|-------------|-------------|----------------------------------------|
| id          | uuid (PK)   | Default: `gen_random_uuid()`           |
| title       | text        | Required                               |
| body        | text        | Letter content (rich text or plain)    |
| status      | text        | `draft` / `open` / `closed`            |
| attachments | jsonb       | Array of storage paths                 |
| created_at  | timestamptz | Default: `now()`                       |
| updated_at  | timestamptz | Default: `now()`                       |

### `signatures` table

| Column         | Type        | Notes                                |
|---------------|-------------|--------------------------------------|
| id            | uuid (PK)   | Default: `gen_random_uuid()`         |
| document_id   | uuid (FK)   | References `documents.id` ON DELETE CASCADE |
| nom           | text        | Required                             |
| appartement   | text        | Required                             |
| signature_data| text        | PNG data URL                         |
| date          | text        | French formatted date (DD/MM/YYYY)   |
| created_at    | timestamptz | Default: `now()`                     |
| updated_at    | timestamptz | Default: `now()`                     |

### Supabase Auth

Admin accounts managed via Supabase Auth (email/password). No custom user tables needed — Supabase provides `auth.users` automatically.

### Supabase Storage

- **Bucket**: `attachments`
- **Structure**: `attachments/{document_id}/{filename}`
- Public read for open documents, admin-only write.

## Row Level Security (RLS)

### `documents`

- **SELECT**: Anyone can read documents where `status = 'open'`. Admins (authenticated) can read all.
- **INSERT / UPDATE / DELETE**: Admins only (authenticated users).

### `signatures`

- **SELECT**: Anyone can read signatures for open documents.
- **INSERT**: Anyone can insert signatures for documents where `status = 'open'`.
- **UPDATE / DELETE**: Admins only.

### Storage (`attachments` bucket)

- **Read**: Public for files belonging to open documents.
- **Write/Delete**: Admins only.

## Route Structure

```
/                        → redirect to first open document
/doc/[id]                → resident view (read document + sign)
/admin/login             → admin login page
/admin                   → dashboard (stats overview)
/admin/documents         → document list + CRUD
/admin/documents/new     → create document form
/admin/documents/[id]    → edit document + manage signatures
/admin/accounts          → manage admin accounts
/admin/export            → bulk PDF export
```

## Page Designs

### Resident View (`/doc/[id]`)

- **Sidebar** (persistent, left): Lists all open documents with title, status badge, and signature count. Active document highlighted. On mobile, sidebar collapses to a hamburger menu.
- **Main content area**:
  - Document title + status badge
  - Letter body in a card
  - Attachment chips (clickable to download)
  - Signature form: name, apartment, canvas, submit button
  - Existing signatures list (name + apartment, collapsible)
  - PDF download button

### Admin Login (`/admin/login`)

- Simple centered card with email + password fields
- Uses Supabase Auth `signInWithPassword`
- Redirects to `/admin` on success

### Admin Dashboard (`/admin`)

- **Admin sidebar** (persistent, left): Documents, Statistiques, Comptes admin, Export
- **Stats bar**: 4 cards showing total documents, open count, total signatures, draft count
- **Quick links** to create document, export, etc.

### Admin Documents (`/admin/documents`)

- Table listing all documents: title, status (colored badge), signature count, created date, action icons (edit, delete, PDF export)
- "+ Nouveau document" button
- Status filter tabs (All / Draft / Open / Closed)

### Admin Document Detail (`/admin/documents/[id]`)

- Edit form: title, body (textarea), status dropdown, attachment upload
- Signatures table: name, apartment, signature preview, date, delete button
- Change status button (draft → open → closed)

### Admin Create Document (`/admin/documents/new`)

- Form: title, body (textarea), attachment upload (multi-file)
- Save as draft or publish directly (open)

### Admin Accounts (`/admin/accounts`)

- List of admin users (email, created date)
- Invite new admin (sends Supabase invite email)
- Remove admin

### Admin Export (`/admin/export`)

- Select documents to export (checkboxes)
- Export individual or bulk PDFs
- Download as ZIP for bulk

## Layout Components

### `SidebarLayout`

Shared layout wrapper used by both resident and admin views. Props control which sidebar content to render.

- Desktop: persistent sidebar (260px)
- Mobile: hamburger toggle, sidebar slides in as overlay

### `AdminGuard`

Layout wrapper for `/admin/*` routes. Checks Supabase session. Redirects to `/admin/login` if not authenticated.

## Supabase Client Setup

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server-side only, for admin operations
```

### Client Creation

- **Browser client**: `@supabase/ssr` `createBrowserClient` — used in client components
- **Server client**: `@supabase/ssr` `createServerClient` — used in server components and API routes
- Middleware to refresh auth session on every request

## Admin Auth Flow

1. Admin navigates to `/admin/login`
2. Enters email + password
3. `supabase.auth.signInWithPassword()` called
4. Session stored in HTTP-only cookies via `@supabase/ssr`
5. Middleware checks session on all `/admin/*` routes (except `/admin/login`)
6. Redirects to login if no valid session

## Migration from Current Data

A one-time migration script (`scripts/migrate.ts`) will:

1. Read `data/signatures.json`
2. Create the first document in Supabase ("Demande urgente de dératisation" with the hardcoded letter body)
3. Insert all 20 signatures linked to that document
4. Upload any existing extracted signature PNGs to Supabase Storage (optional)

## PDF Export

Extends the existing jsPDF logic:

- Per-document export: generates PDF for a single document with its signatures
- Bulk export: generates one PDF per selected document, bundled in a ZIP (using JSZip)
- PDF includes: document title, body, signature table (name, apartment, signature image, date)

## Key Decisions

1. **Supabase over custom DB**: Provides auth, storage, and PostgreSQL in one service — dramatically reduces custom code.
2. **No custom user table for admins**: Supabase Auth handles everything. Admin role determined by being an authenticated user (all auth users are admins).
3. **RLS for access control**: Database-level security instead of API-level checks. Residents interact via the anon key with RLS restricting access.
4. **Sidebar navigation**: Persistent sidebar for document browsing on both resident and admin views. Collapses on mobile.
5. **File-based data removed**: The `data/` directory and JSON file storage are fully replaced by Supabase. Migration script handles the transition.
6. **Attachment storage**: Supabase Storage buckets instead of filesystem. Supports PDF and image uploads.

## New Dependencies

- `@supabase/supabase-js` — Supabase client
- `@supabase/ssr` — Server-side rendering support for auth
- `jszip` — Bulk PDF export bundling (optional, only if bulk export is implemented)

## Out of Scope

- Real-time updates (Supabase supports it, but not needed for v1)
- Email notifications when documents are published
- Resident accounts / authentication (residents remain anonymous signers)
- Document versioning / edit history
- Internationalization (app stays French)
