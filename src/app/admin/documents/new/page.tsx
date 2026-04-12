"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
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

    const { data: doc, error } = await supabase
      .from("documents")
      .insert({ title: title.trim(), body, status })
      .select()
      .single();

    if (error || !doc) {
      console.error("Insert error:", error);
      showToast(error?.message || "Erreur lors de la création");
      setLoading(false);
      return;
    }

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
