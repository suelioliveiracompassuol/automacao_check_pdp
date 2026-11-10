/**
 * Removal of personal data from captured fixtures (src/tests/fixtures), shared by the Android
 * (`npm run fixtures:android`) and Web (`npm run fixtures:web`) capture scripts. Dependency-free.
 */

export const REDACTED = "[removido]";

/** Fields of a review written by (or identifying) the customer. */
export const PERSONAL_REVIEW_FIELDS = [
  "customerName",
  "comment",
  "originalComment",
  "title",
  "nickname",
  "email",
];

/**
 * Query params with the logged-in test account's data (the app sends ?email= on the PDP API) or
 * keys (the Firebase Remote Config fetch carries the web API key: public, but secret scanners
 * block it on push).
 */
const SENSITIVE_QUERY_PARAMS = ["email", "cpf", "phone", "customerId", "token", "access_token", "key"];

export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const param of SENSITIVE_QUERY_PARAMS) {
      if (u.searchParams.has(param)) {
        u.searchParams.set(param, REDACTED);
      }
    }
    return u.toString();
  } catch {
    return url.replace(/([?&](?:email|cpf|phone|token|key)=)[^&]*/gi, `$1${REDACTED}`);
  }
}

/** Reviews API body (/reviews/v2/...) with the reviewers' names and texts replaced. */
export function redactReviews(body: string): string {
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    const data = (json.reviews ? json : (json.data as Record<string, unknown>)) ?? json;
    for (const review of Array.isArray(data.reviews) ? data.reviews : []) {
      for (const field of PERSONAL_REVIEW_FIELDS) {
        if (review && typeof review === "object" && field in review) {
          (review as Record<string, unknown>)[field] = REDACTED;
        }
      }
    }
    if ("aiSummary" in data) {
      data.aiSummary = REDACTED;
    }
    return JSON.stringify(json);
  } catch {
    return body;
  }
}

/**
 * The same fields inside free text (SSR HTML / RSC payload), plain or with escaped quotes:
 * `"customerName":"Ana"` and `\"customerName\":\"Ana\"`.
 */
export function redactPersonalFieldsInText(text: string): string {
  let out = text;
  for (const field of PERSONAL_REVIEW_FIELDS.filter((f) => f !== "title")) {
    out = out
      .replace(new RegExp(`("${field}"\\s*:\\s*")((?:[^"\\\\]|\\\\.)*)(")`, "g"), `$1${REDACTED}$3`)
      .replace(
        new RegExp(`(\\\\"${field}\\\\"\\s*:\\s*\\\\")((?:(?!\\\\").)*)(\\\\")`, "g"),
        `$1${REDACTED}$3`,
      );
  }
  return out;
}

/** Google API keys (Firebase web keys travel in Remote Config values and in the page). */
const GOOGLE_API_KEY = /AIza[0-9A-Za-z_-]{35}/g;

/** Text with keys that secret scanners flag replaced (fixtures are committed). */
export function redactSecrets(text: string): string {
  return text.replace(GOOGLE_API_KEY, REDACTED);
}
