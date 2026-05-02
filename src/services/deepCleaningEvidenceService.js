const BASE_URL = "http://localhost:8787/api/deep-cleaning";

export const DEEP_CLEANING_ASSET_BASE_URL = "http://localhost:8787";

function buildParams(filters = {}) {
  const params = new URLSearchParams();

  if (filters.month && filters.month !== "ALL_MONTHS") params.append("month", filters.month);
  if (filters.storeId && filters.storeId !== "All") params.append("storeId", filters.storeId);
  if (filters.state && filters.state !== "All") params.append("state", filters.state);

  return params;
}

async function parseJsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }

  return payload;
}

export async function fetchDeepCleaningEvidence(filters = {}) {
  const response = await fetch(`${BASE_URL}/evidence?${buildParams(filters)}`);
  return parseJsonResponse(response, "Failed to fetch deep cleaning evidence");
}

export async function uploadDeepCleaningEvidence(formData) {
  const response = await fetch(`${BASE_URL}/evidence`, {
    method: "POST",
    body: formData,
  });

  return parseJsonResponse(response, "Failed to upload deep cleaning evidence");
}

export async function deleteDeepCleaningEvidence(evidenceId) {
  const response = await fetch(`${BASE_URL}/evidence/${encodeURIComponent(evidenceId)}`, {
    method: "DELETE",
  });

  return parseJsonResponse(response, "Failed to delete deep cleaning evidence");
}

export function getDeepCleaningImageUrl(imagePath) {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `${DEEP_CLEANING_ASSET_BASE_URL}${imagePath}`;
}
