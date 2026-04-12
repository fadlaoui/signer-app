import { createClient } from "@/utils/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { count: totalDocs } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true });

  const { count: openDocs } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

  const { count: draftDocs } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("status", "draft");

  const { count: totalSigs } = await supabase
    .from("signatures")
    .select("*", { count: "exact", head: true });

  const stats = [
    { label: "Documents", value: totalDocs ?? 0, color: "text-gray-900" },
    { label: "Ouverts", value: openDocs ?? 0, color: "text-green-600" },
    { label: "Total signatures", value: totalSigs ?? 0, color: "text-indigo-600" },
    { label: "Brouillons", value: draftDocs ?? 0, color: "text-amber-600" },
  ];

  return (
    <div className="p-6 sm:p-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Tableau de bord</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">{stat.label}</div>
            <div className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
