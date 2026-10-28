"use client";

import { authenticatedFetch } from "./api/authenticated-fetch";
import { isolatedWebMode } from "./auth/isolated-web-auth";

export type MediaUploadAuthorization = {
  uploadUrl: string;
  fields: Record<string, string>;
  receipt: string;
  expiresInSeconds: number;
  contentType: string;
  size: number;
  maxBytes: number;
};

const supportedTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"
]);

/**
 * Safari sometimes reports .MOV as video/quicktime, video/x-quicktime,
 * as MP4 or with an empty MIME. Canonicalize metadata only for a .mov file;
 * the API independently verifies its QuickTime ftyp signature.
 */
export function stagingUploadContentType(file: Pick<File, "type" | "name">): string {
  if (/\\.mov$/i.test(file.name) &&
      ["", "video/x-quicktime", "application/octet-stream", "video/quicktime", "video/mp4"].includes(file.type)) {
    return "video/quicktime";
  }
  return file.type;
}

export function validateStagingUploadFile(file: File): string | null {
  if (!isolatedWebMode) return "Direct uploads are only enabled on isolated Hustle staging.";
  const contentType = stagingUploadContentType(file);
  if (!supportedTypes.has(contentType))
    return "Choose JPEG, PNG, WebP, MP4 or a supported iPhone MOV. HEIC photos still require JPEG export.";
  const max = contentType.startsWith("image/") ? 8_000_000 : 30_000_000;
  if (file.size < 1 || file.size > max)
    return `The file must be under ${max / 1_000_000} MB.`;
  return null;
}

export async function authorizeStagingPostMedia(postId: string, file: File) {
  const error = validateStagingUploadFile(file);
  if (error) throw new Error(error);
  const response = await authenticatedFetch(
    `/posts/${encodeURIComponent(postId)}/media/uploads/authorize`,
    {
      method: "POST",
      body: JSON.stringify({ contentType: stagingUploadContentType(file), size: file.size })
    }
  );
  return response.json() as Promise<MediaUploadAuthorization>;
}

/**
 * PUT/POST large files directly to S3 using a 5-minute, narrowly-scoped form
 * policy, NEVER through Cloudflare or Lambda. The browser gets no IAM key/secret.
 * XHR is used for iPhone upload progress and AbortController cancellation.
 */
export function transferFileToPrivateStaging(
  file: File,
  ticket: MediaUploadAuthorization,
  progress: (percentage: number) => void,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = new URL(ticket.uploadUrl);
    if (target.protocol !== "https:" ||
        target.hostname !== "hustle-ux011-isolated-media-707859598737-eu-west-2.s3.eu-west-2.amazonaws.com" ||
        target.pathname !== "/" || target.username || target.password || target.port)
      return reject(new Error("Unexpected staging media upload destination"));
    if (ticket.size !== file.size || ticket.contentType !== stagingUploadContentType(file))
      return reject(new Error("The upload authorization does not match the selected file"));
    if (signal.aborted) return reject(new DOMException("Upload cancelled", "AbortError"));

    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => {
      xhr.abort();
      finish(new DOMException("Upload cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    xhr.open("POST", target.href);
    xhr.withCredentials = false;
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) progress(Math.min(99, Math.round(event.loaded / event.total * 100)));
    };
    xhr.onerror = () => finish(new Error("Direct media transfer failed. Check your connection."));
    xhr.ontimeout = () => finish(new Error("Media upload timed out."));
    xhr.onabort = () => finish(new DOMException("Upload cancelled", "AbortError"));
    xhr.onload = () => xhr.status === 204
      ? finish()
      : finish(new Error(`Private media storage refused the upload (HTTP ${xhr.status}).`));
    xhr.timeout = 120_000;
    const form = new FormData();
    for (const [field, value] of Object.entries(ticket.fields)) form.append(field, value);
    form.append("file", file, file.name);
    xhr.send(form);
  });
}

export async function confirmStagingPostMedia(postId: string, receipt: string) {
  const response = await authenticatedFetch(
    `/posts/${encodeURIComponent(postId)}/media/uploads/confirm`,
    { method: "POST", body: JSON.stringify({ receipt }) }
  );
  return response.json() as Promise<{ mediaId: string; alreadyAttached: boolean }>;
}
