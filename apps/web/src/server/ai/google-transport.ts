import "server-only";
import { GoogleAuth } from "google-auth-library";

/** One transport for Vertex AI (ADC/workload identity) and the Gemini API. */
export const googleProject = () => process.env.GOOGLE_CLOUD_PROJECT?.trim() || process.env.GCLOUD_PROJECT?.trim();
export const googleConfigured = () => Boolean(googleProject() || process.env.GEMINI_API_KEY?.trim());
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

export async function googleGenerateContent(model: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const project = googleProject();
  if (project) {
    const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "global";
    const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
    const token = await auth.getAccessToken();
    if (!token) throw new Error("Google Cloud credentials are unavailable.");
    return fetch(`https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "x-goog-user-project": project },
      body: JSON.stringify(body),
    });
  }
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("Configure GOOGLE_CLOUD_PROJECT with Application Default Credentials, or GEMINI_API_KEY.");
  const base = (process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  return fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", signal, headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body),
  });
}
