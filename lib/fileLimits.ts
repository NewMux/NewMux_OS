/**
 * Largest file a person can upload, in MB. Files are stored in Postgres and
 * pass through memory several times on the way in and out, so the Cloudflare
 * build lowers this (open-next.config.ts): a Worker has 128 MB in total.
 * Inlined at build time, so the server check and the upload hint always agree.
 */
export const MAX_FILE_MB = Number(process.env.NEXT_PUBLIC_MAX_FILE_MB) || 15;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
