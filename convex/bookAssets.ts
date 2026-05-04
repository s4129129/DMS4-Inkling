"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { createHmac, createHash, randomUUID } from "node:crypto";
import { action } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_EXPIRES_SECONDS = 10 * 60;
const DEFAULT_REGION = "auto";
const DEFAULT_PROVIDER = "s3";

function getEnv(name: string) {
  return String(process.env[name] || "").trim();
}

function normalizeEndpoint(value: string) {
  return value.replace(/\/+$/, "");
}

function safeFileName(value: string) {
  const cleaned = String(value || "book")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/\.[a-z0-9]{1,12}$/i, "")
    .slice(0, 140);
  return cleaned || "book";
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacHex(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

function signingKey(secretAccessKey: string, date: string, region: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function amzTimestamp(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function dateStamp(amzDate: string) {
  return amzDate.slice(0, 8);
}

function queryString(params: Record<string, string>) {
  return Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

async function requireUserId(ctx: {
  auth: { getUserIdentity: () => Promise<unknown> };
}) {
  const userId = await getAuthUserId(ctx as never);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

export const generateUploadTarget = action({
  args: {
    fileName: v.string(),
    contentType: v.optional(v.string()),
    fileType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const bucket = getEnv("BOOK_ASSET_BUCKET");
    const endpoint = normalizeEndpoint(getEnv("BOOK_ASSET_ENDPOINT"));
    const accessKeyId = getEnv("BOOK_ASSET_ACCESS_KEY_ID");
    const secretAccessKey = getEnv("BOOK_ASSET_SECRET_ACCESS_KEY");
    const publicBaseUrl = normalizeEndpoint(getEnv("BOOK_ASSET_PUBLIC_BASE_URL"));
    const region = getEnv("BOOK_ASSET_REGION") || DEFAULT_REGION;
    const provider = getEnv("BOOK_ASSET_PROVIDER") || DEFAULT_PROVIDER;

    if (
      !bucket ||
      !endpoint ||
      !accessKeyId ||
      !secretAccessKey ||
      !publicBaseUrl
    ) {
      return {
        configured: false,
        reason:
          "Book object storage is not configured. Falling back to Convex storage.",
      };
    }

    const now = new Date();
    const amzDate = amzTimestamp(now);
    const stamp = dateStamp(amzDate);
    const credentialScope = `${stamp}/${region}/s3/aws4_request`;
    const contentType =
      String(args.contentType || "").trim() || "application/octet-stream";
    const extension =
      String(args.fileName || "")
        .split(".")
        .pop()
        ?.replace(/[^a-z0-9]/gi, "")
        .toLowerCase() || String(args.fileType || "bin").toLowerCase();
    const objectKey = [
      "user-books",
      `${userId}`,
      `${Date.now()}-${randomUUID()}`,
      `${safeFileName(args.fileName)}.${extension}`,
    ].join("/");

    const endpointUrl = new URL(endpoint);
    const host = endpointUrl.host;
    const canonicalUri = `/${encodeURIComponent(bucket)}/${encodePath(
      objectKey,
    )}`;
    const params = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(DEFAULT_EXPIRES_SECONDS),
      "X-Amz-SignedHeaders": "host",
    };
    const canonicalQueryString = queryString(params);
    const canonicalHeaders = `host:${host}\n`;
    const canonicalRequest = [
      "PUT",
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
    ].join("\n");
    const signature = hmacHex(
      signingKey(secretAccessKey, stamp, region),
      stringToSign,
    );
    const uploadUrl = `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
    const publicUrl = `${publicBaseUrl}/${encodePath(objectKey)}`;

    return {
      configured: true,
      provider,
      assetKey: objectKey,
      assetUrl: publicUrl,
      uploadUrl,
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      expiresAt: Date.now() + DEFAULT_EXPIRES_SECONDS * 1000,
    };
  },
});
