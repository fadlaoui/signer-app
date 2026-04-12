"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
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

    const newPaths: string[] = [];
    for (const file of files) {
      const safeName = file.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${id}/${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("attachments").upload(filePath, file, { upsert: true });
      if (uploadErr) {
        console.error("Upload error:", uploadErr);
      } else {
        newPaths.push(filePath);
      }
    }

    const allAttachments = [...(doc?.attachments ?? []), ...newPaths];

    const { error } = await supabase
      .from("documents")
      .update({ title: title.trim(), body, status, attachments: allAttachments })
      .eq("id", id);

    if (error) {
      console.error("Save error:", error);
      showToast("Erreur: " + error.message);
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

  const statusConfig: Record<string, { label: string; cls: string }> = {
    open: { label: "Ouvert", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20" },
    closed: { label: "Fermé", cls: "bg-red-50 text-red-700 ring-1 ring-red-600/20" },
    draft: { label: "Brouillon", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20" },
  };

  if (!doc) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Chargement...</span>
        </div>
      </div>
    );
  }

  const badge = statusConfig[doc.status] ?? statusConfig.draft;

  return (
    <div className="p-6 sm:p-10 lg:p-16">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 sm:p-8 mb-8 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[12px] text-blue-200/70 mb-3">
            <Link href="/admin/documents" className="hover:text-white transition-colors">Documents</Link>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-white/90 truncate max-w-[200px]">{doc.title}</span>
          </div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Modifier le document</h1>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-white/15 text-white">{badge.label}</span>
                  <span className="text-blue-200/70 text-xs">
                    Créé le {new Date(doc.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleDeleteDocument}
              className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-white/70 hover:text-red-200 hover:bg-white/10 font-medium transition-all cursor-pointer px-3 py-2 rounded-lg"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Supprimer
            </button>
          </div>
        </div>
      </div>

      {/* Doc stats mini strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{signatures.length}</p>
            <p className="text-[10px] text-gray-400">Signatures</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{doc.attachments?.length ?? 0}</p>
            <p className="text-[10px] text-gray-400">Pièces jointes</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{new Date(doc.created_at).toLocaleDateString("fr-FR")}</p>
            <p className="text-[10px] text-gray-400">Date création</p>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm mb-6 space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Titre</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Contenu</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all resize-y"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Statut</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all bg-white"
          >
            <option value="draft">Brouillon</option>
            <option value="open">Ouvert</option>
            <option value="closed">Fermé</option>
          </select>
        </div>

        {doc.attachments.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Pièces jointes</label>
            <div className="flex flex-wrap gap-2">
              {doc.attachments.map((path, i) => (
                <div key={i} className="flex items-center gap-2 bg-blue-50 text-blue-700 text-[11px] font-medium px-3 py-1.5 rounded-lg">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                  <span>{path.split("/").pop()}</span>
                  <button
                    onClick={() => handleRemoveAttachment(path)}
                    className="text-red-400 hover:text-red-600 ml-0.5 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Ajouter des pièces jointes</label>
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? "Sauvegarde..." : "Enregistrer les modifications"}
        </button>
      </div>

      {/* Signatures Section */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Signatures</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{signatures.length} signature{signatures.length !== 1 ? "s" : ""} collectée{signatures.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </div>
        </div>
        {signatures.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Aucune signature pour le moment</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {signatures.map((sig) => (
              <div key={sig.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-violet-600">{sig.nom.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 truncate">{sig.nom}</p>
                  <p className="text-[11px] text-gray-400">Appt. {sig.appartement}</p>
                </div>
                <div className="flex items-center justify-center shrink-0 w-20">
                  {sig.signature_data === "placeholder" ? (
                    <span className="text-[10px] italic text-gray-300">--</span>
                  ) : (
                    <img src={sig.signature_data} alt="" className="h-6 w-auto max-w-[80px] object-contain" />
                  )}
                </div>
                <span className="text-[11px] text-gray-400 shrink-0">{sig.date}</span>
                <button
                  onClick={() => handleDeleteSignature(sig.id)}
                  className="text-gray-300 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 cursor-pointer shrink-0 transition-all"
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
