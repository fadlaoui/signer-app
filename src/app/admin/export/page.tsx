"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
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
      const filename = doc.title.replace(/[^a-zA-Z0-9\u00C0-\u017F\s-]/g, "").replace(/\s+/g, "_");

      if (selected.size === 1) {
        pdf.save(`${filename}.pdf`);
        setLoading(false);
        showToast("PDF téléchargé");
        return;
      }

      zip.file(`${filename}.pdf`, pdf.output("arraybuffer"));
    }

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

  const statusConfig: Record<string, { label: string; cls: string }> = {
    open: { label: "Ouvert", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20" },
    closed: { label: "Fermé", cls: "bg-red-50 text-red-700 ring-1 ring-red-600/20" },
    draft: { label: "Brouillon", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20" },
  };

  const openCount = documents.filter(d => d.status === "open").length;
  const closedCount = documents.filter(d => d.status === "closed").length;

  return (
    <div className="p-6 sm:p-10 lg:p-16">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 sm:p-8 mb-8 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <div>
              <p className="text-blue-200 text-xs font-medium tracking-wide uppercase mb-1">Outils</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Export PDF</h1>
              <p className="text-blue-200/80 text-sm mt-1">Exportez vos documents avec les signatures au format PDF</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{documents.length}</p>
            <p className="text-[11px] text-gray-400">Documents</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{openCount}</p>
            <p className="text-[11px] text-gray-400">Ouverts</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{selected.size}</p>
            <p className="text-[11px] text-gray-400">Sélectionnés</p>
          </div>
        </div>
      </div>

      {/* Document Selection */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Sélectionnez les documents</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Choisissez les documents à inclure dans l&apos;export</p>
          </div>
          <button onClick={selectAll} className="text-[11px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer transition-colors">
            {selected.size === documents.length ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        </div>
        {documents.map((doc) => {
          const badge = statusConfig[doc.status] ?? statusConfig.draft;
          return (
            <label
              key={doc.id}
              className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(doc.id)}
                onChange={() => toggleSelect(doc.id)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <span className="text-[13px] font-medium text-gray-800 flex-1 truncate">{doc.title}</span>
              <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
                {badge.label}
              </span>
            </label>
          );
        })}
        {documents.length === 0 && (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Aucun document disponible</p>
          </div>
        )}
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={loading || selected.size === 0}
        className="w-full py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm inline-flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Export en cours...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exporter {selected.size} document{selected.size > 1 ? "s" : ""} en PDF
          </>
        )}
      </button>

      <Toast message={toast} />
    </div>
  );
}
