const API_BASE = `http://${window.location.hostname}:8787/api`;

export async function updateFaultRemark(ticketNumber, remark) {
  const response = await fetch(`${API_BASE}/workflow/faults/${encodeURIComponent(ticketNumber)}/remark`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ remark }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update fault remark");
  }

  return response.json();
}
