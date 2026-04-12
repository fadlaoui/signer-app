"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { jsPDF } from "jspdf";
import { createClient } from "@/utils/supabase/client";
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
    const W = 210; const mL = 22; const mR = 22; const cW = W - mL - mR;
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

    const col1 = cW * 0.28; const col2 = cW * 0.14;
    const col3 = cW * 0.44; const col4 = cW * 0.14;
    const hH = 7; const rH = 10;

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

    const filename = document.title.replace(/[^a-zA-Z0-9àâäéèêëïîôùû\u0153\u0152ÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s-]/g, "").replace(/\s+/g, "_");
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

            {signatures.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-5">
                <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">Signatures</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-300">{signatures.length} signature{signatures.length > 1 ? "s" : ""}</span>
                    <button onClick={generatePDF} className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium transition-colors cursor-pointer">📥 PDF</button>
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
