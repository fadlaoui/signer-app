"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { jsPDF } from "jspdf";

const SignatureCanvas = dynamic(() => import("./components/SignatureCanvas"), { ssr: false });

interface SignEntry {
  id: string;
  nom: string;
  appartement: string;
  signatureData: string;
  date: string;
}

export default function Home() {
  const [nom, setNom] = useState("");
  const [appartement, setAppartement] = useState("");
  const [hasSig, setHasSig] = useState(false);
  const [entries, setEntries] = useState<SignEntry[]>([]);
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState(false);
  const [letterTitle, setLetterTitle] = useState("Demande urgente de dératisation — copropriété");
  const [letterBody, setLetterBody] = useState(
    "Monsieur,\n\nNous, copropriétaires de l'immeuble, souhaitons vous alerter sur la présence de rats et de souris constatée dans les parties communes. Plusieurs résidents ont signalé ces nuisibles et un rat a même été retrouvé récemment, ce qui confirme la gravité de la situation.\n\nIl s'agit d'un problème sérieux d'hygiène et de salubrité qui nécessite une prise en charge immédiate. Nous vous demandons donc d'organiser en urgence une dératisation complète de l'immeuble ainsi qu'un contrôle des parties communes afin d'identifier l'origine du problème.\n\nDans l'attente de votre retour rapide sur les mesures mises en place.\n\nLes copropriétaires"
  );
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/signatures");
      const data = await res.json();
      setEntries(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchEntries();
  }, [fetchEntries]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

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

    try {
      const isEdit = editingEntry !== null;
      const res = await fetch("/api/signatures", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit && { id: editingEntry }),
          nom: nom.trim(),
          appartement: appartement.trim(),
          signatureData: sigData,
          date: new Date().toLocaleDateString("fr-FR"),
        }),
      });

      if (res.ok) {
        await fetchEntries();
        setNom("");
        setAppartement("");
        setHasSig(false);
        setEditingEntry(null);
        canvasRef.current = null;
        showToast(isEdit ? "Signature modifiée" : "Signature ajoutée");
      } else {
        showToast("Erreur lors de l'envoi");
      }
    } catch {
      showToast("Erreur réseau");
    }
    setSubmitting(false);
  }

  function startEdit(entry: SignEntry) {
    setEditingEntry(entry.id);
    setNom(entry.nom);
    setAppartement(entry.appartement);
    setHasSig(false);
    canvasRef.current = null;
    formRef.current?.scrollIntoView({ behavior: "smooth" });
    showToast("Redessinez votre signature");
  }

  function cancelEdit() {
    setEditingEntry(null);
    setNom("");
    setAppartement("");
    setHasSig(false);
    canvasRef.current = null;
  }

  async function removeEntry(id: string) {
    try {
      const res = await fetch(`/api/signatures?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchEntries();
        showToast("Signature supprimée");
      }
    } catch { /* ignore */ }
  }

  function generatePDF() {
    if (entries.length === 0) { showToast("Aucune signature"); return; }

    const doc = new jsPDF("p", "mm", "a4");
    const W = 210;
    const mL = 22;
    const mR = 22;
    const cW = W - mL - mR;
    let y = 22;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 17, 17);
    const title = doc.splitTextToSize("Objet : " + letterTitle, cW);
    doc.text(title, W / 2, y, { align: "center" });
    y += title.length * 6 + 8;

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(mL, y, W - mR, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);

    const paras = letterBody.split("\n");

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

    const col1 = cW * 0.28;
    const col2 = cW * 0.14;
    const col3 = cW * 0.44;
    const col4 = cW * 0.14;
    const hH = 7;

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

    const rH = 10;
    for (const entry of entries) {
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

      if (entry.signatureData !== "placeholder") {
        try {
          doc.addImage(entry.signatureData, "PNG", mL + col1 + col2 + 2, y + 1, col3 - 4, rH - 2);
        } catch { /* fallback */ }
      }

      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(entry.date, mL + col1 + col2 + col3 + 2, y + rH / 2 + 1);

      y += rH;
    }

    doc.save("Lettre_Deratisation.pdf");
    showToast("PDF téléchargé");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-indigo-600 px-4 sm:px-6 py-3">
        <div className="text-center">
          <h1 className="text-white text-base sm:text-lg md:text-xl font-bold leading-snug mb-1">
            Demande urgente de dératisation
          </h1>
          <p className="text-indigo-200 text-[11px] sm:text-xs leading-relaxed max-w-xl mx-auto">
            Signez cette lettre collective pour demander une intervention rapide dans les parties communes de l&apos;immeuble.
          </p>
          {entries.length > 0 && (
            <span className="text-[11px] bg-white/20 text-white px-2.5 py-1 rounded-full mt-1 inline-block">
              {entries.length} signature{entries.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </header>

      {!mounted ? (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-sm text-gray-400">Chargement...</p>
        </div>
      ) : (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Letter card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 md:p-8 mb-5 sm:mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">Contenu de la lettre</span>
            <button
              onClick={() => setEditing(!editing)}
              className="text-[11px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
              </svg>
              {editing ? "Terminer" : "Modifier"}
            </button>
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Objet</label>
                <input
                  type="text"
                  value={letterTitle}
                  onChange={(e) => setLetterTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Corps de la lettre</label>
                <textarea
                  value={letterBody}
                  onChange={(e) => setLetterBody(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm text-gray-800 leading-relaxed outline-none focus:border-indigo-500 transition-colors resize-y"
                />
              </div>
            </div>
          ) : (
            <div className="text-sm leading-relaxed text-gray-600 space-y-3">
              <p className="font-semibold text-gray-800 text-base mb-1">Objet : {letterTitle}</p>
              {letterBody.split("\n").map((line, i) =>
                line.trim() === "" ? null : (
                  <p key={i} className={
                    line.startsWith("Monsieur") ? "text-gray-400 italic" :
                    line.startsWith("Dans l'attente") ? "text-gray-400" :
                    line.startsWith("Les copropriétaires") ? "font-semibold text-gray-800 pt-1" : ""
                  }>
                    {line}
                  </p>
                )
              )}
            </div>
          )}
        </div>

        {/* Datagrid */}
        {entries.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-5 sm:mb-6">
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-gray-400">
                Signatures des copropriétaires
              </span>
              <span className="text-[10px] sm:text-[11px] text-gray-300">
                {entries.length} entrée{entries.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* Mobile: card layout */}
            <div className="sm:hidden divide-y divide-gray-50">
              {entries.map((entry) => (
                <div key={entry.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium text-gray-800 truncate">{entry.nom}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">{entry.appartement}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {entry.signatureData === "placeholder" ? (
                        <span className="text-[10px] italic text-gray-300">Signature manquante</span>
                      ) : (
                        <img src={entry.signatureData} alt="" className="h-6 w-auto max-w-[100px] object-contain" />
                      )}
                      <span className="text-[10px] text-gray-300 tabular-nums">{entry.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(entry)}
                      className="text-gray-300 active:text-indigo-500 p-1.5"
                      title="Modifier"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="text-gray-300 active:text-red-400 p-1.5"
                      title="Supprimer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table layout */}
            <table className="hidden sm:table w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-semibold tracking-wider uppercase text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-2.5 w-[30%]">Nom</th>
                  <th className="px-5 py-2.5 w-[14%]">Appt</th>
                  <th className="px-5 py-2.5">Signature</th>
                  <th className="px-5 py-2.5 w-[14%]">Date</th>
                  <th className="w-[60px]"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-50 last:border-0 hover:bg-indigo-50/40 transition-colors group">
                    <td className="px-5 py-3 text-[13px] font-medium text-gray-800">{entry.nom}</td>
                    <td className="px-5 py-3 text-[12px] text-gray-500 tabular-nums">{entry.appartement}</td>
                    <td className="px-5 py-2">
                      {entry.signatureData === "placeholder" ? (
                        <span className="text-[11px] italic text-gray-300">Signature manquante</span>
                      ) : (
                        <img src={entry.signatureData} alt="" className="h-8 w-auto max-w-[140px] object-contain" />
                      )}
                    </td>
                    <td className="px-5 py-3 text-[11px] text-gray-400 tabular-nums">{entry.date}</td>
                    <td className="pr-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(entry)}
                          className="text-gray-300 hover:text-indigo-500 cursor-pointer p-1"
                          title="Modifier"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="text-gray-300 hover:text-red-400 cursor-pointer p-1"
                          title="Supprimer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sign form */}
        <div ref={formRef} className={`bg-white border rounded-2xl shadow-sm p-4 sm:p-6 md:p-8 ${editingEntry ? "border-indigo-300 ring-2 ring-indigo-100" : "border-gray-200"}`}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              {editingEntry ? "Modifier votre signature" : "Ajouter votre signature"}
            </h2>
            {editingEntry && (
              <button
                onClick={cancelEdit}
                className="text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                Annuler
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-6">
            {editingEntry ? "Redessinez votre signature ci-dessous" : "Entrez vos informations et signez ci-dessous"}
          </p>

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
          <SignatureCanvas key={`${entries.length}-${editingEntry}`} onSignatureChange={handleSignatureChange} />

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={addSignature}
              disabled={submitting}
              className="flex-1 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Envoi en cours..." : editingEntry ? "Enregistrer les modifications" : "Ajouter ma signature"}
            </button>
            {entries.length > 0 && (
              <button
                onClick={generatePDF}
                className="flex-1 py-3 border-2 border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:border-indigo-200 hover:text-indigo-600 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
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
      )}

      {/* Toast */}
      <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-xl transition-all duration-300 ${toast ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"} pointer-events-none z-50`}>
        {toast}
      </div>
    </main>
  );
}
