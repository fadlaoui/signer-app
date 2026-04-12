"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import Toast from "@/app/components/Toast";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
}

export default function AdminAccounts() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const supabase = createClient();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setUsers([
        {
          id: data.user.id,
          email: data.user.email ?? "",
          created_at: data.user.created_at,
        },
      ]);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast("Email et mot de passe requis");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    if (res.ok) {
      showToast("Administrateur ajouté");
      setEmail("");
      setPassword("");
    } else {
      const data = await res.json();
      showToast(data.error || "Erreur lors de l'invitation");
    }
    setLoading(false);
  }

  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Comptes administrateurs</h1>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">Administrateurs</span>
        </div>
        {users.map((user) => (
          <div key={user.id} className="px-5 py-3 flex items-center justify-between border-b border-gray-50 last:border-0">
            <div>
              <span className="text-[13px] font-medium text-gray-800">{user.email}</span>
              <span className="text-[11px] text-gray-300 ml-3">
                Depuis le {new Date(user.created_at).toLocaleDateString("fr-FR")}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-900 mb-4">Ajouter un administrateur</h2>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nouvel-admin@example.com"
              required
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Ajout..." : "Ajouter"}
          </button>
        </form>
      </div>

      <Toast message={toast} />
    </div>
  );
}
