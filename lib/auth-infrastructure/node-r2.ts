import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

/** R2's S3-compatible API for the production Node/VPS backend. */
export function getNodeR2Bucket(env: NodeJS.ProcessEnv) {
  const config: R2Config = {
    accountId: env.R2_ACCOUNT_ID?.trim() ?? "",
    accessKeyId: env.R2_ACCESS_KEY_ID?.trim() ?? "",
    secretAccessKey: env.R2_SECRET_ACCESS_KEY?.trim() ?? "",
    bucket: env.R2_BUCKET_NAME?.trim() ?? "",
  };
  if (!/^[a-f0-9]{32}$/i.test(config.accountId) || !config.accessKeyId ||
      !config.secretAccessKey || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(config.bucket)) return undefined;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return {
    async put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }) {
      return client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: Buffer.from(value),
        ContentType: options?.httpMetadata?.contentType,
        CacheControl: options?.httpMetadata?.cacheControl,
      }));
    },
    async get(key: string) {
      const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key })).catch(err => {
        if (err?.name === "NoSuchKey" || err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) return null;
        throw err;
      });
      if (!result?.Body) return null;
      return {
        body: result.Body.transformToWebStream() as ReadableStream,
        httpMetadata: { contentType: result.ContentType },
      };
    },
  };
}
