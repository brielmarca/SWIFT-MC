const MAX_FILE_BYTES = 700_000;
export const MAX_EDITOR_IMAGE_BYTES = MAX_FILE_BYTES;

export type ValidatedImage = { data: Uint8Array; mime: "image/png" | "image/jpeg" | "image/webp"; alt: string };

export async function validateEditorImage(file: File, rawAlt: string): Promise<ValidatedImage> {
  const alt = rawAlt.trim();
  if (alt.length < 5 || alt.length > 180) throw new Error("ALT_INVALID");
  if (file.size < 32 || file.size > MAX_FILE_BYTES) throw new Error("SIZE_INVALID");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength < 32 || bytes.byteLength > MAX_FILE_BYTES) throw new Error("SIZE_INVALID");

  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 &&
    bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP";
  const mime = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : null;
  if (!mime || file.type !== mime) throw new Error("TYPE_INVALID");
  // Do not accept SVG, GIF, PDF, HTML or executable formats as editorial images.
  return { data: bytes, mime, alt };
}
