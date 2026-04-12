"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface DocItem {
  id: string;
  title: string;
  status: string;
  signature_count: number;
}

export default function Sidebar({ documents }: { documents: DocItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const content = (
    <div className="h-full flex flex-col">
      <div className="font-bold text-lg mb-5 pb-3 border-b border-white/20 flex items-center justify-between">
        <span>Documents</span>
        <button
          onClick={() => setOpen(false)}
          className="sm:hidden text-white/60 hover:text-white p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {documents.map((doc) => {
          const isActive = pathname === `/doc/${doc.id}`;
          return (
            <Link
              key={doc.id}
              href={`/doc/${doc.id}`}
              onClick={() => setOpen(false)}
              className={`block rounded-lg p-3 transition-colors ${
                isActive
                  ? "bg-white/15 border-l-[3px] border-indigo-300"
                  : "bg-white/5 border-l-[3px] border-transparent hover:bg-white/10"
              }`}
            >
              <div className="text-[13px] font-semibold truncate">{doc.title}</div>
              <div className="text-[11px] opacity-70 mt-1">
                {doc.status === "open" ? "🟢 Ouvert" : "🔴 Fermé"} · {doc.signature_count} signature{doc.signature_count !== 1 ? "s" : ""}
              </div>
            </Link>
          );
        })}
        {documents.length === 0 && (
          <p className="text-sm opacity-50 text-center py-8">Aucun document</p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden fixed top-3 left-3 z-40 bg-indigo-700 text-white p-2 rounded-lg shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-indigo-900 text-white p-4 shadow-2xl">
            {content}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden sm:block w-[260px] bg-indigo-900 text-white p-4 flex-shrink-0 h-screen sticky top-0 overflow-y-auto">
        {content}
      </div>
    </>
  );
}
