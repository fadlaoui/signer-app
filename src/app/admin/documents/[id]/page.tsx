"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
