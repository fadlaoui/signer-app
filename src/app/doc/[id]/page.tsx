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
      <div className="flex min-h-screen bg-gray-50/80">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-gray-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50/80">
      <Sidebar documents={documents} />

      <div className="flex-1 min-w-0">
        {document ? (
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
                      <p className="text-blue-200 text-xs font-medium tracking-wide uppercase mb-1">Document</p>
                      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{document.title}</h1>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${document.status === "open" ? "bg-white/15 text-emerald-200" : "bg-white/15 text-red-200"}`}>
                          {document.status === "open" ? "Ouvert aux signatures" : "Fermé"}
                        </span>
                        <span className="text-blue-200/70 text-xs flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                          {signatures.length} signature{signatures.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  {signatures.length > 0 && (
                    <button
                      onClick={generatePDF}
                      className="hidden sm:inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Télécharger PDF
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 mb-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Contenu du document</h2>
              </div>
              <div className="text-sm leading-relaxed text-gray-600 space-y-3">
                {document.body.split("\n").map((line, i) =>
                  line.trim() === "" ? null : <p key={i}>{line}</p>
                )}
              </div>
              {document.attachments.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                  {document.attachments.map((path, i) => {
                    const filename = path.split("/").pop() || "fichier";
                    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attachments/${path}`;
                    return (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                        </svg>
                        {filename}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sign form */}
            {document.status === "open" && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 sm:p-6 mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900">Ajouter votre signature</h2>
                </div>
                <p className="text-xs text-gray-400 mb-5 ml-10">Entrez vos informations et signez ci-dessous</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom complet</label>
                    <input
                      type="text"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      placeholder="Nom et Prénom"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Appartement</label>
                    <input
                      type="text"
                      value={appartement}
                      onChange={(e) => setAppartement(e.target.value)}
                      placeholder="ex: B-12"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                    />
                  </div>
                </div>

                <label className="block text-xs font-medium text-gray-500 mb-1.5">Signature</label>
                <SignatureCanvas key={signatures.length} onSignatureChange={handleSignatureChange} />

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    onClick={addSignature}
                    disabled={submitting}
                    className="flex-1 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm inline-flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Envoi en cours...
                      </>
                    ) : "Ajouter ma signature"}
                  </button>
                </div>
              </div>
            )}

            {/* Signatures list */}
            {signatures.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Signatures</h2>
                      <p className="text-[11px] text-gray-400">{signatures.length} signature{signatures.length !== 1 ? "s" : ""} collectée{signatures.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <button
                    onClick={generatePDF}
                    className="sm:hidden inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    PDF
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {signatures.map((entry) => (
                    <div key={entry.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                      <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-violet-600">{entry.nom.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-800 truncate">{entry.nom}</p>
                        <p className="text-[11px] text-gray-400">Appt. {entry.appartement}</p>
                      </div>
                      <div className="flex items-center justify-center shrink-0 w-20">
                        {entry.signature_data === "placeholder" ? (
                          <span className="text-[10px] italic text-gray-300">--</span>
                        ) : (
                          <img src={entry.signature_data} alt="" className="h-6 w-auto max-w-[80px] object-contain" />
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0">{entry.date}</span>
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
