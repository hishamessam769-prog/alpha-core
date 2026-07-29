import { supabase } from "./supabase";

export const RECOMMENDATION_IMAGE_TITLE = "__ALPHA_RECOMMENDATION_IMAGE__";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function splitRecommendationUpdates(rows = []) {
  const mediaUpdate = rows.find((row) => row.title === RECOMMENDATION_IMAGE_TITLE) || null;
  return {
    imageUrl: mediaUpdate?.body?.trim() || "",
    mediaUpdate,
    visibleUpdates: rows.filter((row) => row.title !== RECOMMENDATION_IMAGE_TITLE),
  };
}

export function validateRecommendationImage(file) {
  if (!file) return "No image selected.";
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return "Use PNG, JPG or WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 3 MB or smaller.";
  return "";
}

export async function uploadRecommendationImage({ recommendationId, file, profileId }) {
  const validationError = validateRecommendationImage(file);
  if (validationError) throw new Error(validationError);
  if (!recommendationId) throw new Error("Save the recommendation before uploading its image.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
  const path = `recommendations/${recommendationId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("platform-assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("platform-assets").getPublicUrl(path);
  const imageUrl = data?.publicUrl;
  if (!imageUrl) throw new Error("The image uploaded, but its public URL could not be created.");
  await persistRecommendationImage({ recommendationId, imageUrl, profileId });
  return imageUrl;
}

export async function persistRecommendationImage({ recommendationId, imageUrl, profileId }) {
  const { data: existingRows, error: selectError } = await supabase
    .from("recommendation_updates")
    .select("id")
    .eq("recommendation_id", recommendationId)
    .eq("title", RECOMMENDATION_IMAGE_TITLE)
    .order("created_at", { ascending: false })
    .limit(1);
  if (selectError) throw selectError;
  const existing = existingRows?.[0] || null;

  const payload = {
    recommendation_id: recommendationId,
    update_date: new Date().toISOString().slice(0, 10),
    title: RECOMMENDATION_IMAGE_TITLE,
    body: imageUrl || "",
  };

  if (existing?.id) {
    const { error } = await supabase.from("recommendation_updates").update(payload).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase.from("recommendation_updates").insert({ ...payload, created_by: profileId }).select("id").single();
  if (error) throw error;
  return data?.id;
}
