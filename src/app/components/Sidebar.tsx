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
      {/* Brand */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
          O
        </div>
        <div>
          <div className="text-[14px] font-bold text-gray-900 leading-tight">Les Orchidées</div>
          <div className="text-[10px] text-gray-400">Portail Résidents</div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="sm:hidden ml-auto text-gray-400 hover:text-gray-600 p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Menu label */}
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Documents ouverts</p>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {documents.map((doc) => {
          const isActive = pathname === `/doc/${doc.id}`;
          return (
            <Link
              key={doc.id}
              href={`/doc/${doc.id}`}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-blue-100" : "bg-gray-100"}`}>
                <svg className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[13px] truncate ${isActive ? "font-semibold" : "font-medium"}`}>{doc.title}</div>
                <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${doc.status === "open" ? "bg-emerald-500" : "bg-red-500"}`} />
                  {doc.signature_count} signature{doc.signature_count !== 1 ? "s" : ""}
                </div>
              </div>
            </Link>
          );
        })}
        {documents.length === 0 && (
          <div className="px-3 py-8 text-center">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-xs text-gray-400">Aucun document</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-gray-200 mt-4 space-y-1">
        <Link
          href="/admin/login"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all"
        >
          <svg className="w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          Espace Admin
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden fixed top-3 left-3 z-40 bg-white text-gray-700 p-2 rounded-xl shadow-md border border-gray-200"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[250px] bg-white p-4 shadow-2xl">
            {content}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden sm:block w-[250px] bg-white border-r border-gray-200 p-4 flex-shrink-0 h-screen sticky top-0 overflow-y-auto">
        {content}
      </div>
    </>
  );
}
