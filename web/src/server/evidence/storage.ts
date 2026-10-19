/**
 * Private object storage over the S3 API (ADR-005; SeaweedFS in development and on our own server, any S3-compatible
 * store in production). The bucket is never public: files go out only through short-lived presigned URLs issued
 * after a permission check, and every issue is written to the evidence access log.
 */
import { CopyObjectCommand, CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

export function s3(): S3Client {
  if (!client) {
    const endpoint = process.env.S3_ENDPOINT;
    if (!endpoint || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) throw new Error("S3 storage is not configured (scripts/dev-env.mjs)");
    client = new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
    });
  }
  return client;
}

export const bucket = () => process.env.S3_BUCKET ?? "isoline-evidence";

export async function ensureBucket(): Promise<void> {
  try {
    await s3().send(new HeadBucketCommand({ Bucket: bucket() }));
  } catch {
    await s3().send(new CreateBucketCommand({ Bucket: bucket() }));
  }
}

export async function putObject(key: string, body: Uint8Array, mime: string, sha256: string): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: mime, Metadata: { sha256 } }));
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!r.Body) throw new Error(`empty object ${key}`);
  return r.Body.transformToByteArray();
}

export async function moveObject(from: string, to: string): Promise<void> {
  await s3().send(new CopyObjectCommand({ Bucket: bucket(), CopySource: `${bucket()}/${encodeURIComponent(from).replace(/%2F/g, "/")}`, Key: to }));
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: from }));
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** RFC 6266 attachment header with an ASCII fallback and the UTF-8 name. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function presignDownload(key: string, filename: string, mime: string, seconds = 300): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentDisposition: contentDisposition(filename), ResponseContentType: mime }), { expiresIn: seconds });
}
