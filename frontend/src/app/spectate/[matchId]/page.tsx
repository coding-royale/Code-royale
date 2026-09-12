import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSpectateSnapshot } from "@/app/api/spectate/[matchId]/route";
import { SpectateClient } from "./spectate-client";

type PageProps = {
  params: Promise<{ matchId: string }> | { matchId: string };
};

export default async function SpectatePage({ params }: PageProps) {
  const resolved = await params;
  const matchId = resolved?.matchId?.trim() || null;
  if (!matchId) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user?.id) {
    redirect("/auth/login");
  }

  let snapshot;
  try {
    snapshot = await getSpectateSnapshot(matchId as string);
  } catch (error) {
    console.error("Spectate page error", error);
    notFound();
  }
  if (!snapshot) {
    notFound();
  }

  return <SpectateClient initial={snapshot} />;
}
