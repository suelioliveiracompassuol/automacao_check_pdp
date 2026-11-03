/**
 * SFCC (Salesforce Commerce Cloud) catalog export, read over WebDAV with an Account
 * Manager API client (client credentials). Credentials only come from the environment.
 */

const TOKEN_URL = "https://account.demandware.com/dwsso/oauth2/access_token";
const DEFAULT_WEBDAV_BASE =
  "https://production-na01-natura.demandware.net/on/demandware.servlet/webdav/Sites";

/** Export file per operation. Only Natura BR for now; other countries have their own site folder. */
export const CATALOG_SOURCES: Record<string, { file: string }> = {
  "natura-BR": { file: "/Impex/mccfeeds/NatBrazil/catalog_export_retrofit.psv" },
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} não definido (coloque no .env.local ou nos secrets do workflow).`);
  }
  return value;
}

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${requireEnv("SFCC_CLIENT_ID")}:${requireEnv("SFCC_CLIENT_SECRET")}`,
  ).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`Falha ao obter token do SFCC: HTTP ${res.status}`);
  }
  const { access_token: token } = (await res.json()) as { access_token?: string };
  if (!token) {
    throw new Error("Resposta de token do SFCC sem access_token.");
  }
  return token;
}

export interface DownloadedCatalog {
  file: string;
  text: string;
  lastModified?: string;
}

export async function downloadCatalog(operation: string): Promise<DownloadedCatalog> {
  const source = CATALOG_SOURCES[operation];
  if (!source) {
    throw new Error(
      `Operação sem catálogo configurado: ${operation} (disponíveis: ${Object.keys(CATALOG_SOURCES).join(", ")})`,
    );
  }
  const base = process.env.SFCC_WEBDAV_BASE || DEFAULT_WEBDAV_BASE;
  const token = await getAccessToken();
  const res = await fetch(base + source.file, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Falha ao baixar ${source.file}: HTTP ${res.status}`);
  }
  const lastModified = res.headers.get("last-modified");
  return {
    file: source.file,
    text: await res.text(),
    lastModified: lastModified ? new Date(lastModified).toISOString() : undefined,
  };
}
