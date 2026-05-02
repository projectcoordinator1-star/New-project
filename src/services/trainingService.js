const BASE_URL = "http://localhost:8787/api/training";

export async function fetchEvidence(filters = {}) {
  const params = new URLSearchParams();
  if (filters.state && filters.state !== "All") params.append("state", filters.state);
  if (filters.fieldOffice && filters.fieldOffice !== "All") params.append("fieldOffice", filters.fieldOffice);
  if (filters.storeId && filters.storeId !== "All") params.append("storeId", filters.storeId);

  const response = await fetch(`${BASE_URL}/evidence?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch training evidence");
  }
  return response.json();
}

export async function fetchTrainingOptions() {
  const response = await fetch(`${BASE_URL}/options`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch training options");
  }
  return response.json();
}

export async function uploadEvidence(formData) {
  const response = await fetch(`${BASE_URL}/evidence`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to upload training evidence");
  }
  return response.json();
}

export async function deleteEvidence(evidenceId) {
  const response = await fetch(`${BASE_URL}/evidence/${evidenceId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete training evidence");
  }
  return response.json();
}
