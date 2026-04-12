import { createClient } from "@/utils/supabase/server";
import Link from "next/link";

export default async function AdminDocuments() {
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  const docsWithCounts = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { count } = await supabase
        .from("signatures")
        .select("*", { count: "exact", head: true })
        .eq("document_id", doc.id);
      return { ...doc, signature_count: count ?? 0 };
    })
  );

  const totalDocs = docsWithCounts.length;
  const openDocs = docsWithCounts.filter((d) => d.status === "open").length;
  const draftDocs = docsWithCounts.filter((d) => d.status === "draft").length;
  const totalSigs = docsWithCounts.reduce((sum, d) => sum + d.signature_count, 0);

  const statusBadge: Record<string, { label: string; cls: string }> = {
    open: { label: "Ouvert", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20" },
    closed: { label: "Fermé", cls: "bg-red-50 text-red-700 ring-1 ring-red-600/20" },
    draft: { label: "Brouillon", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20" },
  };

  return (
    <div className="p-6 sm:p-10 lg:p-16">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 sm:p-8 mb-8 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <p className="text-blue-200 text-xs font-medium tracking-wide uppercase mb-1">Gestion</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Documents</h1>
                <p className="text-blue-200/80 text-sm mt-1">Gérez les documents de la copropriété</p>
              </div>
            </div>
            <Link
              href="/admin/documents/new"
              className="hidden sm:inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nouveau document
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{totalDocs}</p>
            <p className="text-[11px] text-gray-400">Total</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{openDocs}</p>
            <p className="text-[11px] text-gray-400">Ouverts</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{draftDocs}</p>
            <p className="text-[11px] text-gray-400">Brouillons</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{totalSigs}</p>
            <p className="text-[11px] text-gray-400">Signatures</p>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_80px] px-5 py-3 bg-gray-50/80 text-[10px] font-semibold tracking-wider uppercase text-gray-400 border-b border-gray-100">
          <span>Titre</span>
          <span>Statut</span>
          <span>Signatures</span>
          <span>Créé le</span>
          <span></span>
        </div>
        {docsWithCounts.map((doc) => {
          const badge = statusBadge[doc.status] ?? statusBadge.draft;
          return (
            <div
              key={doc.id}
              className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_80px] px-5 py-4 border-b border-gray-50 last:border-0 items-center gap-2 sm:gap-0 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <span className="font-medium text-[13px] text-gray-800 truncate">{doc.title}</span>
              </div>
              <span><span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span></span>
              <span className="text-[13px] text-gray-500 font-medium flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                {doc.signature_count}
              </span>
              <span className="text-[12px] text-gray-400">
                {new Date(doc.created_at).toLocaleDateString("fr-FR")}
              </span>
              <span>
                <Link
                  href={`/admin/documents/${doc.id}`}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-[12px] font-medium transition-colors"
                >
                  Modifier
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              </span>
            </div>
          );
        })}
        {docsWithCounts.length === 0 && (
          <div className="px-5 py-16 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">Aucun document</p>
            <p className="text-xs text-gray-400 mt-1">Créez votre premier document pour commencer</p>
            <Link href="/admin/documents/new" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-xs font-medium mt-3">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Créer un document
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
