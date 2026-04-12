import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("documents")
    .select("id")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (data) {
    redirect(`/doc/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-800 mb-2">Aucun document disponible</h1>
        <p className="text-sm text-gray-500">Aucun document n&apos;est ouvert aux signatures pour le moment.</p>
      </div>
    </div>
  );
}
