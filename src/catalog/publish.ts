import type { CatalogQualityReport } from "./types.js";

/**
 * The catalog validation is only shown to logged-in users, so it is not published with the
 * dashboard (the static export would expose it): it goes to Firestore, whose rules only let
 * authenticated users read this collection. One document per operation.
 */
export const CATALOG_QUALITY_COLLECTION = "catalogQuality";

/** Firestore rejects documents above 1 MiB; leave room for field overhead. */
const MAX_DOC_BYTES = 900_000;

export function hasFirestoreCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY,
  );
}

export async function publishCatalogQuality(report: CatalogQualityReport): Promise<void> {
  // Firestore rejects undefined values (e.g. source.lastModified when WebDAV sends no
  // Last-Modified); a JSON round trip drops them, like the local .quality.json.
  const json = JSON.stringify(report);
  const size = Buffer.byteLength(json);
  if (size > MAX_DOC_BYTES) {
    throw new Error(
      `Validação do catálogo ${report.operation} tem ${Math.round(size / 1024)} KB, acima do limite de um documento do Firestore.`,
    );
  }
  // Imported here so a run without credentials never initializes firebase-admin.
  const { db } = await import("../firebase.js");
  await db.collection(CATALOG_QUALITY_COLLECTION).doc(report.operation).set(JSON.parse(json));
}
