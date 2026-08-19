import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";

const AVATAR_BUCKET = "avatars";
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = authData.user.id;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Image must be 4MB or smaller" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const admin = createSupabaseServiceClient();

  // Ensure the public bucket exists on the first upload.
  const { data: bucket } = await admin.storage.getBucket(AVATAR_BUCKET);
  if (!bucket) {
    const { error: createError } = await admin.storage.createBucket(AVATAR_BUCKET, {
      public: true,
    });
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
  }

  const { error: uploadError } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl: avatarUrl },
  } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  // Persist the URL. Insert when the player has no stats row yet.
  const { data: existing } = await admin
    .from("player_stats")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const { error: updateError } = existing
    ? await admin.from("player_stats").update({ avatar_url: avatarUrl }).eq("user_id", userId)
    : await admin.from("player_stats").insert({ user_id: userId, avatar_url: avatarUrl });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: avatarUrl });
}