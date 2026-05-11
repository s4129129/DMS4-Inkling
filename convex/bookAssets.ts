"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { createHmac, createHash, randomUUID } from "node:crypto";
import { action } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_EXPIRES_SECONDS = 10 * 60;
const DEFAULT_REGION = "auto";
const DEFAULT_PROVIDER = "s3";
const COVER_CONTENT_TYPE = "image/webp";
const MAX_GROUP_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_USER_ICON_BYTES = 10 * 1024 * 1024;
const MAX_GROUP_ICON_BYTES = 10 * 1024 * 1024;

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

function normalizeSha256(value: string | undefined) {
  const hash = String(value || "")
    .trim()
    .toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : null;
}

function safeExtension(value: string | undefined, fallback: string) {
  const extension = String(value || "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  return extension || fallback;
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

function getObjectStorageConfig() {
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
      configured: false as const,
      reason:
        "Book object storage is not configured. Set Convex BOOK_ASSET_* environment variables.",
    };
  }

  return {
    configured: true as const,
    bucket,
    endpoint,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
    region,
    provider,
  };
}

function createSignedPutTarget({
  bucket,
  endpoint,
  accessKeyId,
  secretAccessKey,
  publicBaseUrl,
  region,
  objectKey,
  contentType,
}: {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  region: string;
  objectKey: string;
  contentType: string;
}) {
  const now = new Date();
  const amzDate = amzTimestamp(now);
  const stamp = dateStamp(amzDate);
  const credentialScope = `${stamp}/${region}/s3/aws4_request`;
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

  return {
    uploadUrl: `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`,
    publicUrl: `${publicBaseUrl}/${encodePath(objectKey)}`,
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    expiresAt: Date.now() + DEFAULT_EXPIRES_SECONDS * 1000,
  };
}

function coverKeyForBookAsset(bookAssetKey: string, contentHash?: string) {
  const cleanedKey = String(bookAssetKey || "")
    .trim()
    .replace(/^\/+/, "")
    .split("?")[0];
  const parts = cleanedKey.split("/").filter(Boolean);
  const fileName = parts.pop() || "book";
  const baseName = fileName.replace(/\.[a-z0-9]{1,12}$/i, "") || "book";
  const coverName = `${normalizeSha256(contentHash) ?? safeFileName(baseName)}.webp`;
  return [...parts, "covers", coverName].join("/");
}

function objectKeyForUserAsset({
  userId,
  folder,
  fileName,
  fileType,
  contentHash,
}: {
  userId: unknown;
  folder: string;
  fileName: string;
  fileType?: string;
  contentHash?: string;
}) {
  const extension = safeExtension(
    String(fileName || "")
      .split(".")
      .pop()
      ?.toLowerCase(),
    String(fileType || "bin").toLowerCase(),
  );
  const hash = normalizeSha256(contentHash);
  const safeFolder = String(folder || "uploads")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9/_-]/gi, "-")
    .replace(/\/{2,}/g, "/");

  if (hash) {
    return ["user-assets", `${userId}`, safeFolder, "sha256", `${hash}.${extension}`].join("/");
  }

  return [
    "user-assets",
    `${userId}`,
    safeFolder,
    `${Date.now()}-${randomUUID()}`,
    `${safeFileName(fileName)}.${extension}`,
  ].join("/");
}

function assertMaxBytes(byteSize: number | undefined, maxBytes: number, message: string) {
  const normalizedSize = Math.max(0, Math.floor(byteSize || 0));
  if (normalizedSize > maxBytes) {
    throw new Error(message);
  }
}

function createUserAssetTarget({
  userId,
  folder,
  fileName,
  contentType,
  fileType,
  byteSize,
  contentHash,
  maxBytes,
}: {
  userId: unknown;
  folder: string;
  fileName: string;
  contentType?: string;
  fileType?: string;
  byteSize?: number;
  contentHash?: string;
  maxBytes?: number;
}) {
  if (maxBytes) {
    assertMaxBytes(byteSize, maxBytes, "File is too large.");
  }

  const config = getObjectStorageConfig();
  if (!config.configured) {
    return config;
  }

  const safeContentType =
    String(contentType || "").trim() || "application/octet-stream";
  const objectKey = objectKeyForUserAsset({
    userId,
    folder,
    fileName,
    fileType,
    contentHash,
  });
  const signedTarget = createSignedPutTarget({
    bucket: config.bucket,
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    publicBaseUrl: config.publicBaseUrl,
    region: config.region,
    objectKey,
    contentType: safeContentType,
  });

  return {
    configured: true,
    provider: config.provider,
    assetKey: objectKey,
    assetUrl: signedTarget.publicUrl,
    uploadUrl: signedTarget.uploadUrl,
    method: signedTarget.method,
    headers: signedTarget.headers,
    expiresAt: signedTarget.expiresAt,
  };
}

export const generateUploadTarget = action({
  args: {
    fileName: v.string(),
    contentType: v.optional(v.string()),
    fileType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
    contentHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const userId = await requireUserId(ctx);
      const config = getObjectStorageConfig();

      if (!config.configured) {
        return config;
      }

      const contentType =
        String(args.contentType || "").trim() || "application/octet-stream";
      const extension = safeExtension(
        String(args.fileName || "")
          .split(".")
          .pop()
          ?.toLowerCase(),
        String(args.fileType || "bin").toLowerCase(),
      );
      const contentHash = normalizeSha256(args.contentHash);
      const objectKey = contentHash
        ? [
            "user-books",
            `${userId}`,
            "sha256",
            `${contentHash}.${extension}`,
          ].join("/")
        : [
            "user-books",
            `${userId}`,
            `${Date.now()}-${randomUUID()}`,
            `${safeFileName(args.fileName)}.${extension}`,
          ].join("/");

      const signedTarget = createSignedPutTarget({
        bucket: config.bucket,
        endpoint: config.endpoint,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        publicBaseUrl: config.publicBaseUrl,
        region: config.region,
        objectKey,
        contentType,
      });

      return {
        configured: true,
        provider: config.provider,
        assetKey: objectKey,
        assetHash: contentHash ?? undefined,
        assetUrl: signedTarget.publicUrl,
        uploadUrl: signedTarget.uploadUrl,
        method: signedTarget.method,
        headers: signedTarget.headers,
        expiresAt: signedTarget.expiresAt,
      };
    } catch (error) {
      console.error("generateUploadTarget failed", error);
      return {
        configured: false as const,
        reason:
          error instanceof Error
            ? error.message
            : "Book object storage upload target failed.",
      };
    }
  },
});

export const generateCoverUploadTarget = action({
  args: {
    bookAssetKey: v.string(),
    contentHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const config = getObjectStorageConfig();

    if (!config.configured) {
      return config;
    }

    const normalizedBookKey = String(args.bookAssetKey || "")
      .trim()
      .replace(/^\/+/, "");
    const userPrefix = `user-books/${userId}/`;
    if (!normalizedBookKey.startsWith(userPrefix)) {
      throw new Error("Book asset does not belong to the current user.");
    }

    const objectKey = coverKeyForBookAsset(
      normalizedBookKey,
      args.contentHash,
    );
    const signedTarget = createSignedPutTarget({
      bucket: config.bucket,
      endpoint: config.endpoint,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      publicBaseUrl: config.publicBaseUrl,
      region: config.region,
      objectKey,
      contentType: COVER_CONTENT_TYPE,
    });

    return {
      configured: true,
      provider: config.provider,
      coverAssetKey: objectKey,
      coverUrl: signedTarget.publicUrl,
      uploadUrl: signedTarget.uploadUrl,
      method: signedTarget.method,
      headers: signedTarget.headers,
      expiresAt: signedTarget.expiresAt,
    };
  },
});

export const generateGroupAttachmentUploadTarget = action({
  args: {
    groupId: v.string(),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    fileType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
    contentHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    assertMaxBytes(
      args.byteSize,
      MAX_GROUP_ATTACHMENT_BYTES,
      "Attachment must be 25MB or smaller.",
    );

    return createUserAssetTarget({
      userId,
      folder: `group-attachments/${String(args.groupId || "group")}`,
      fileName: args.fileName,
      contentType: args.contentType,
      fileType: args.fileType,
      byteSize: args.byteSize,
      contentHash: args.contentHash,
      maxBytes: MAX_GROUP_ATTACHMENT_BYTES,
    });
  },
});

export const generateGroupIconUploadTarget = action({
  args: {
    groupId: v.string(),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    fileType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const contentType = String(args.contentType || "").trim();
    if (!contentType.startsWith("image/")) {
      throw new Error("Image only.");
    }

    return createUserAssetTarget({
      userId,
      folder: `group-icons/${String(args.groupId || "group")}`,
      fileName: args.fileName || "group-icon",
      contentType,
      fileType: args.fileType,
      byteSize: args.byteSize,
      maxBytes: MAX_GROUP_ICON_BYTES,
    });
  },
});

export const generateUserIconUploadTarget = action({
  args: {
    fileName: v.string(),
    contentType: v.optional(v.string()),
    fileType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return createUserAssetTarget({
      userId,
      folder: "profile-icons",
      fileName: args.fileName,
      contentType: args.contentType,
      fileType: args.fileType,
      byteSize: args.byteSize,
      maxBytes: MAX_USER_ICON_BYTES,
    });
  },
});

export const generateBannerUploadTarget = action({
  args: {
    fileName: v.string(),
    contentType: v.optional(v.string()),
    fileType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return createUserAssetTarget({
      userId,
      folder: "custom-banners",
      fileName: args.fileName,
      contentType: args.contentType,
      fileType: args.fileType,
      byteSize: args.byteSize,
    });
  },
});
