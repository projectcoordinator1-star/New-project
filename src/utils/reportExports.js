import { formatDisplayValue } from "./formatters";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value) {
  return String(value || "report")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildSummaryMarkup(summaryCards = []) {
  if (!summaryCards.length) {
    return "";
  }

  return `
    <section>
      <h2>Summary</h2>
      <table>
        <thead>
          <tr><th>Metric</th><th>Value</th><th>Note</th></tr>
        </thead>
        <tbody>
          ${summaryCards
            .map(
              (card) =>
                `<tr><td>${escapeHtml(card.label)}</td><td>${escapeHtml(formatDisplayValue(card.value))}</td><td>${escapeHtml(
                  card.note,
                )}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function buildFilterMarkup(filters = []) {
  if (!filters.length) {
    return `<p class="muted">No extra filters applied.</p>`;
  }

  return `
    <div class="chip-row">
      ${filters
        .map((filter) => `<span class="chip"><b>${escapeHtml(filter.label)}:</b> ${escapeHtml(filter.value)}</span>`)
        .join("")}
    </div>
  `;
}

function buildChartMarkup(chart) {
  if (!chart?.items?.length) {
    return "";
  }

  const rows = chart.items
    .map((item) => {
      const secondary = item.secondary !== undefined ? ` / ${escapeHtml(formatDisplayValue(item.secondary))}` : "";
      const value = item.value !== undefined ? escapeHtml(formatDisplayValue(item.value)) : escapeHtml(formatDisplayValue(item.primary));
      return `<tr><td>${escapeHtml(item.label)}</td><td>${value}${secondary}</td></tr>`;
    })
    .join("");

  return `
    <section>
      <h2>${escapeHtml(chart.title || "Chart")}</h2>
      <p class="muted">${escapeHtml(chart.subtitle || "")}</p>
      <table>
        <thead>
          <tr><th>Series</th><th>Value</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function buildTableMarkup(table) {
  const columns = table?.columns || [];
  const rows = table?.rows || [];

  return `
    <section>
      <h2>Detailed Records</h2>
      <table>
        <thead>
          <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) =>
                `<tr>${columns
                  .map((column) => `<td>${escapeHtml(formatDisplayValue(row[column.key]))}</td>`)
                  .join("")}</tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function buildGalleryMarkup(beforeAfter) {
  if (!beforeAfter?.items?.length) {
    return "";
  }

  return `
    <section>
      <h2>${escapeHtml(beforeAfter.title || "Before / After Gallery")}</h2>
      <p class="muted">${escapeHtml(beforeAfter.subtitle || "")}</p>
      ${beforeAfter.items
        .map(
          (item) => `
            <div class="gallery-row">
              <div class="gallery-card">
                <strong>${escapeHtml(item.site)}</strong>
                <span>${escapeHtml(item.beforeLabel || "Before")}</span>
              </div>
              <div class="gallery-card gallery-card--after">
                <strong>${escapeHtml(item.area || "Area")}</strong>
                <span>${escapeHtml(item.afterLabel || "After")}</span>
              </div>
              <div class="gallery-note">${escapeHtml(item.note || "")}</div>
            </div>
          `,
        )
        .join("")}
    </section>
  `;
}

function buildBaseDocument(result) {
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(result.title)}</title>
        <style>
          body { font-family: Aptos, Arial, sans-serif; margin: 24px; color: #21324b; }
          h1 { margin: 0 0 8px; font-size: 26px; }
          h2 { margin: 0 0 10px; font-size: 18px; }
          p { margin: 0 0 14px; line-height: 1.5; }
          .muted { color: #5c7088; }
          .chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 18px; }
          .chip { padding: 8px 12px; border-radius: 999px; background: #f3f7fc; border: 1px solid #d9e4f0; font-size: 12px; }
          section { margin-top: 22px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #dbe3ee; padding: 8px 10px; text-align: left; vertical-align: top; }
          th { background: #eef4fb; color: #173252; }
          .gallery-row { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 12px; margin-top: 12px; }
          .gallery-card, .gallery-note { border: 1px solid #dbe3ee; border-radius: 16px; padding: 14px; background: #f8fbff; }
          .gallery-card--after { background: #eefaf4; }
          .gallery-card strong, .gallery-card span { display: block; }
          .gallery-card span { margin-top: 6px; color: #5c7088; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(result.title)}</h1>
        <p class="muted">${escapeHtml(result.subtitle || "")}</p>
        ${buildFilterMarkup(result.filterSummary)}
        ${buildSummaryMarkup(result.summaryCards)}
        ${buildChartMarkup(result.chart)}
        ${buildTableMarkup(result.table)}
        ${buildGalleryMarkup(result.beforeAfter)}
      </body>
    </html>
  `;
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function exportToExcel(result) {
  const columns = result.table?.columns || [];
  const rows = result.table?.rows || [];
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8" /></head>
      <body>
        <h1>${escapeHtml(result.title)}</h1>
        <p>${escapeHtml(result.subtitle || "")}</p>
        ${buildFilterMarkup(result.filterSummary)}
        ${buildSummaryMarkup(result.summaryCards)}
        ${buildTableMarkup({ columns, rows })}
      </body>
    </html>
  `;

  downloadBlob(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" }), `${slugify(result.title)}.xls`);
}

function exportToPdf(result) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1280,height=900");
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildBaseDocument(result));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);
}

function exportToPpt(result) {
  downloadBlob(
    new Blob([buildBaseDocument(result)], { type: "application/vnd.ms-powerpoint;charset=utf-8;" }),
    `${slugify(result.title)}-deck.ppt`,
  );
}

export function exportReport(result, format) {
  if (!result) {
    return;
  }

  if (format === "excel") {
    exportToExcel(result);
    return;
  }

  if (format === "pdf") {
    exportToPdf(result);
    return;
  }

  if (format === "ppt") {
    exportToPpt(result);
  }
}
