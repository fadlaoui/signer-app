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
