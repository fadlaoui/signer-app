"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Tableau de bord", icon: "📊" },
  { href: "/admin/documents", label: "Documents", icon: "📄" },
  { href: "/admin/accounts", label: "Comptes admin", icon: "👥" },
  { href: "/admin/export", label: "Export", icon: "📦" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  const content = (
    <div className="h-full flex flex-col">
      <div className="font-bold text-base mb-5 pb-3 border-b border-white/20 flex items-center justify-between">
        <span>Admin</span>
        <button
          onClick={() => setOpen(false)}
          className="sm:hidden text-white/60 hover:text-white p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2.5 text-[13px] transition-colors ${
                isActive ? "bg-white/10 font-medium" : "opacity-70 hover:opacity-100 hover:bg-white/5"
              }`}
            >
              {item.icon} {item.label}
            </Link>
          );
        })}
      </div>
      <div className="pt-4 border-t border-white/20 mt-4 space-y-2">
        <Link
          href="/"
          className="block text-[12px] opacity-60 hover:opacity-100 transition-opacity"
        >
          ← Retour au site
        </Link>
        <button
          onClick={handleLogout}
          className="block text-[12px] text-red-300 hover:text-red-200 transition-colors cursor-pointer"
        >
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden fixed top-3 left-3 z-40 bg-gray-800 text-white p-2 rounded-lg shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[220px] bg-gray-900 text-white p-4 shadow-2xl">
            {content}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden sm:block w-[220px] bg-gray-900 text-white p-4 flex-shrink-0 h-screen sticky top-0 overflow-y-auto">
        {content}
      </div>
    </>
  );
}
