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
