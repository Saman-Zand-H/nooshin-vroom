export async function prepareImage(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG, or WebP picture.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Choose a picture smaller than 5 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That picture could not be opened. Try another file.");
  }
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 40_000_000
    )
      throw new Error("Choose a picture smaller than 40 megapixels.");
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Your browser could not prepare this picture.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.86),
    );
    if (!blob)
      throw new Error("Could not save this picture. Try another file.");
    return blob;
  } finally {
    bitmap.close();
  }
}

export function validateRecording(file: File) {
  const m4aByExtension = file.name.toLowerCase().endsWith(".m4a");
  if (
    !m4aByExtension &&
    ![
      "audio/mpeg",
      "audio/mp4",
      "audio/x-m4a",
      "audio/m4a",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "video/mp4",
      "video/webm",
    ].includes(file.type)
  )
    throw new Error("Choose an MP3, M4A, WAV, OGG, MP4, or WebM recording.");
  if (file.size > 50 * 1024 * 1024)
    throw new Error("Keep recordings under 50 MB.");
}
