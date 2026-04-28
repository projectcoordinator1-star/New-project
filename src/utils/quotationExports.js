import { roundNumber } from "./formatters";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value) {
  return String(value || "quotation")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0";
  }

  return roundNumber(numeric, 2).toFixed(2).replace(/\.00$/, "");
}

function formatDateForDocument(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return text;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function normalizeComparable(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function splitTaxes(baseAmount, gstRate, vendorState, customerState) {
  const totalGst = (baseAmount * gstRate) / 100;
  const sameState =
    normalizeComparable(vendorState) && normalizeComparable(vendorState) === normalizeComparable(customerState);

  if (sameState) {
    const halfTax = totalGst / 2;
    return {
      sgstAmount: halfTax,
      cgstAmount: halfTax,
      igstAmount: 0,
      totalGst,
    };
  }

  return {
    sgstAmount: 0,
    cgstAmount: 0,
    igstAmount: totalGst,
    totalGst,
  };
}

function numberToWordsUnderThousand(value) {
  const ones = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

  const numeric = Math.floor(Math.abs(value));
  if (numeric < 20) {
    return ones[numeric];
  }

  if (numeric < 100) {
    return `${tens[Math.floor(numeric / 10)]}${numeric % 10 ? ` ${ones[numeric % 10]}` : ""}`.trim();
  }

  return `${ones[Math.floor(numeric / 100)]} HUNDRED${numeric % 100 ? ` ${numberToWordsUnderThousand(numeric % 100)}` : ""}`.trim();
}

function numberToWordsIndian(value) {
  const numeric = Math.round(Number(value) || 0);
  if (!numeric) {
    return "ZERO RUPEES ONLY";
  }

  const parts = [];
  const crore = Math.floor(numeric / 10000000);
  const lakh = Math.floor((numeric % 10000000) / 100000);
  const thousand = Math.floor((numeric % 100000) / 1000);
  const remainder = numeric % 1000;

  if (crore) {
    parts.push(`${numberToWordsUnderThousand(crore)} CRORE`);
  }

  if (lakh) {
    parts.push(`${numberToWordsUnderThousand(lakh)} LAKH`);
  }

  if (thousand) {
    parts.push(`${numberToWordsUnderThousand(thousand)} THOUSAND`);
  }

  if (remainder) {
    parts.push(numberToWordsUnderThousand(remainder));
  }

  return `${parts.join(" ").trim()} RUPEES ONLY`;
}

function calculateLine(line, form) {
  const quantity = Number(line.quantity) || 0;
  const rate = Number(line.benchmarkRate) || 0;
  const amount = quantity * rate;
  const managementFeesPct = Number(line.managementFeesPct) || 0;
  const managementFeeAmount = (amount * managementFeesPct) / 100;
  const baseAmount = amount + managementFeeAmount;
  const gstRate = Number(line.gstRate || form.gstRate) || 0;
  const taxes = splitTaxes(baseAmount, gstRate, form.vendorState, form.billToState || form.shipToState);
  const totalInclAmount = baseAmount + taxes.totalGst;

  return {
    ...line,
    quantity,
    rate,
    amount,
    managementFeesPct,
    managementFeeAmount,
    baseAmount,
    gstRate,
    ...taxes,
    totalInclAmount,
  };
}

function buildRowsMarkup(lines) {
  return lines
    .map(
      (line, index) => `
        <tr>
          <td class="center nowrap">${index + 1}</td>
          <td class="nowrap">${escapeHtml(line.arcNo || "")}</td>
          <td class="nowrap">${escapeHtml(line.arcLine || "")}</td>
          <td class="nowrap">${escapeHtml(line.hsn || "")}</td>
          <td class="nowrap">${escapeHtml(line.finalServiceCode || line.oldServiceCode || "")}</td>
          <td>${escapeHtml(line.shortText || "")}</td>
          <td>${escapeHtml(line.sapDescription || line.shortText || line.longText || "")}</td>
          <td>${escapeHtml(line.approvedBrand || "")}</td>
          <td>${escapeHtml(line.model || "")}</td>
          <td class="num">${escapeHtml(formatMoney(line.quantity))}</td>
          <td class="center nowrap">${escapeHtml(line.uom || "")}</td>
          <td class="num">${escapeHtml(formatMoney(line.rate))}</td>
          <td class="num">${escapeHtml(formatMoney(line.amount))}</td>
          <td class="num">${escapeHtml(formatMoney(line.managementFeesPct))}</td>
          <td class="num">${escapeHtml(formatMoney(line.baseAmount))}</td>
          <td class="num">${escapeHtml(formatMoney(line.gstRate))}</td>
          <td class="num">${escapeHtml(formatMoney(line.sgstAmount))}</td>
          <td class="num">${escapeHtml(formatMoney(line.cgstAmount))}</td>
          <td class="num">${escapeHtml(formatMoney(line.igstAmount))}</td>
          <td class="num">${escapeHtml(formatMoney(line.totalGst))}</td>
          <td class="num">${escapeHtml(formatMoney(line.totalInclAmount))}</td>
          <td>${escapeHtml(line.remarks || "")}</td>
          <td colspan="2">${escapeHtml(line.additionalRemarks || "")}</td>
        </tr>
      `,
    )
    .join("");
}

function buildQuotationHtml(payload) {
  const totals = payload.computedLines.reduce(
    (acc, line) => {
      acc.amount += line.amount;
      acc.managementFeeAmount += line.managementFeeAmount;
      acc.baseAmount += line.baseAmount;
      acc.sgstAmount += line.sgstAmount;
      acc.cgstAmount += line.cgstAmount;
      acc.igstAmount += line.igstAmount;
      acc.totalGst += line.totalGst;
      acc.totalInclAmount += line.totalInclAmount;
      return acc;
    },
    {
      amount: 0,
      managementFeeAmount: 0,
      baseAmount: 0,
      sgstAmount: 0,
      cgstAmount: 0,
      igstAmount: 0,
      totalGst: 0,
      totalInclAmount: 0,
    },
  );

  const roundedGrandTotal = Math.round(totals.totalInclAmount);
  const columnWidths = [
    "2%",
    "4.2%",
    "3.2%",
    "3.2%",
    "4.4%",
    "10.4%",
    "12.4%",
    "5.4%",
    "4.4%",
    "2.6%",
    "2.6%",
    "3.6%",
    "4.1%",
    "3.3%",
    "4.2%",
    "2.9%",
    "3.3%",
    "3.3%",
    "3.3%",
    "3.7%",
    "4.3%",
    "5.2%",
    "5.2%",
    "1.3%",
  ];

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(payload.quotationNo || "Quotation")}</title>
        <style>
          @page { size: A4 landscape; margin: 6mm; }
          html, body { width: 100%; }
          body { font-family: Arial, sans-serif; margin: 0; color: #111; }
          html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          td, th {
            border: 1px solid #111;
            padding: 2px 3px;
            font-size: 8px;
            vertical-align: top;
            line-height: 1.15;
            word-wrap: break-word;
            overflow-wrap: anywhere;
          }
          .title {
            font-size: 12px;
            font-weight: 700;
            text-align: center;
            letter-spacing: 0.06em;
            background: #eee1b7;
          }
          .label { font-weight: 700; }
          .section { background: #c7d7ea; font-weight: 700; }
          .num { text-align: right; }
          .center { text-align: center; }
          .small { font-size: 7.4px; }
          .nowrap { white-space: nowrap; }
          .tight { line-height: 1.05; }
          .terms td { border-top: 0; }
          .signature { height: 38px; vertical-align: bottom; text-align: center; }
          .meta-cell { line-height: 1.18; background: #faf6e8; }
          .party-cell { background: #fbf8ef; }
          .head-row td { font-size: 7.4px; padding: 3px 2px; background: #f4edd5; }
          .subject-row td { background: #fff9e6; }
          .total-row td { background: #f6efdc; font-weight: 700; }
          .words-row td { background: #fbf7eb; }
          .terms-row td { background: #f8f8f8; }
          .footer-row td { background: #fcfcfc; }
        </style>
      </head>
      <body>
        <table>
          <colgroup>
            ${columnWidths.map((width) => `<col style="width:${width}" />`).join("")}
          </colgroup>
          <tr><td colspan="24" class="title">QUOTATION</td></tr>
          <tr>
            <td colspan="8" class="meta-cell"><span class="label">Name of Vendor :</span> ${escapeHtml(payload.vendorName)}</td>
            <td colspan="8" class="meta-cell"><span class="label">Quotation Date:</span> ${escapeHtml(formatDateForDocument(payload.quotationDate))}</td>
            <td colspan="8" class="meta-cell"><span class="label">Store Name :</span> ${escapeHtml(payload.storeName)}</td>
          </tr>
          <tr>
            <td colspan="8" class="meta-cell"><span class="label">Vendor Address :</span> ${escapeHtml(payload.vendorAddress)}</td>
            <td colspan="8" class="meta-cell"><span class="label">Quotation No:</span> ${escapeHtml(payload.quotationNo)}</td>
            <td colspan="8" class="meta-cell"><span class="label">Format :</span> ${escapeHtml(payload.formatName)}</td>
          </tr>
          <tr>
            <td colspan="4" class="meta-cell"><span class="label">Vendor State :</span> ${escapeHtml(payload.vendorState)}</td>
            <td colspan="4" class="meta-cell"><span class="label">Vendor State Code:</span> ${escapeHtml(payload.vendorStateCode)}</td>
            <td colspan="8" class="meta-cell"><span class="label">FM Fault No:</span> ${escapeHtml(payload.fmFaultNo)}</td>
            <td colspan="4" class="meta-cell"><span class="label">Store Code :</span> ${escapeHtml(payload.storeCode)}</td>
            <td colspan="4" class="meta-cell"><span class="label">Category :</span> ${escapeHtml(payload.category)}</td>
          </tr>
          <tr>
            <td colspan="4" class="meta-cell"><span class="label">Vendor GSTIN :</span> ${escapeHtml(payload.vendorGstin)}</td>
            <td colspan="4" class="meta-cell"><span class="label">Mobile Number :</span> ${escapeHtml(payload.vendorMobile)}</td>
            <td colspan="8" class="meta-cell"><span class="label">FM Fault Date:</span> ${escapeHtml(formatDateForDocument(payload.fmFaultDate))}</td>
            <td colspan="4" class="meta-cell"><span class="label">Company Code :</span> ${escapeHtml(payload.companyCode)}</td>
            <td colspan="4"></td>
          </tr>
          <tr>
            <td colspan="4" class="meta-cell"><span class="label">Vendor Code :</span> ${escapeHtml(payload.vendorCode)}</td>
            <td colspan="4" class="meta-cell"><span class="label">Email id:</span> ${escapeHtml(payload.vendorEmail)}</td>
            <td colspan="8" class="meta-cell"><span class="label">Vendor Contact Person:</span> ${escapeHtml(payload.vendorContactPerson)}</td>
            <td colspan="8"></td>
          </tr>
          <tr>
            <td colspan="12" class="section center">Bill to Party</td>
            <td colspan="12" class="section center">Ship to Party</td>
          </tr>
          <tr>
            <td colspan="12" class="party-cell"><span class="label">Name :</span> ${escapeHtml(payload.billToName)}</td>
            <td colspan="12" class="party-cell"><span class="label">Name :</span> ${escapeHtml(payload.shipToName)}</td>
          </tr>
          <tr>
            <td colspan="12" class="party-cell"><span class="label">Address :</span> ${escapeHtml(payload.billToAddress)}</td>
            <td colspan="12" class="party-cell"><span class="label">Address :</span> ${escapeHtml(payload.shipToAddress)}</td>
          </tr>
          <tr>
            <td colspan="6" class="party-cell"><span class="label">State :</span> ${escapeHtml(payload.billToState)}</td>
            <td colspan="6" class="party-cell"><span class="label">GSTIN :</span> ${escapeHtml(payload.billToGstin)}</td>
            <td colspan="6" class="party-cell"><span class="label">State :</span> ${escapeHtml(payload.shipToState)}</td>
            <td colspan="6" class="party-cell"><span class="label">GSTIN :</span> ${escapeHtml(payload.shipToGstin)}</td>
          </tr>
          <tr class="subject-row">
            <td colspan="24" class="tight"><span class="label">Sub :</span> ${escapeHtml(payload.subject)}</td>
          </tr>
          <tr class="section center head-row">
            <td>SNo</td>
            <td>ARC No.</td>
            <td>ARC Line</td>
            <td>HSN/SAC Code</td>
            <td>Article/Service Code</td>
            <td>Description of Material/Service (Short Text)</td>
            <td>SAP Description</td>
            <td>Approved Make/Brand</td>
            <td>Model</td>
            <td>Qty</td>
            <td>UOM</td>
            <td>Rate (Rs)</td>
            <td>Amount</td>
            <td>Management Ent Fees (%)</td>
            <td>Base Amount</td>
            <td>SGST/UGST GST Rate</td>
            <td>SGST/UGST Amt</td>
            <td>CGST Amt</td>
            <td>IGST Amt</td>
            <td>Total GST</td>
            <td>Total incl Amount</td>
            <td>Remarks(In Item/Not-ARC Line Item)</td>
            <td colspan="2">Additional Remarks</td>
          </tr>
          ${buildRowsMarkup(payload.computedLines)}
          <tr class="total-row">
            <td colspan="12" class="num label">Total Amount</td>
            <td class="num">${escapeHtml(formatMoney(totals.amount))}</td>
            <td class="num">${escapeHtml(formatMoney(totals.managementFeeAmount))}</td>
            <td class="num">${escapeHtml(formatMoney(totals.baseAmount))}</td>
            <td></td>
            <td class="num">${escapeHtml(formatMoney(totals.sgstAmount))}</td>
            <td class="num">${escapeHtml(formatMoney(totals.cgstAmount))}</td>
            <td class="num">${escapeHtml(formatMoney(totals.igstAmount))}</td>
            <td class="num">${escapeHtml(formatMoney(totals.totalGst))}</td>
            <td class="num">${escapeHtml(formatMoney(roundedGrandTotal))}</td>
            <td colspan="3"></td>
          </tr>
          <tr class="words-row">
            <td colspan="24" class="small"><span class="label">Total Invoice Amount in words - </span>${escapeHtml(numberToWordsIndian(roundedGrandTotal))}</td>
          </tr>
          <tr class="terms terms-row">
            <td colspan="16" class="small">
              <span class="label">Terms & Conditions if any :</span><br/>
              ${escapeHtml(payload.paymentTerms)}<br/>
              ${escapeHtml(payload.warranty)}
            </td>
            <td colspan="8" class="small signature">
              <span class="label">${escapeHtml(payload.authorizedSignatory)}</span><br/>
              Signature of authorised signatory with seal
            </td>
          </tr>
          <tr class="footer-row">
            <td colspan="24" class="small">${escapeHtml(payload.footerNote)}</td>
          </tr>
        </table>
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

function printHtmlDocument(html) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 200);
  };

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      cleanup();
      return;
    }

    frameWindow.onafterprint = cleanup;
    frameWindow.focus();
    window.setTimeout(() => {
      frameWindow.print();
    }, 300);
  };

  iframe.srcdoc = html;
}

export function buildQuotationPayload(form, draftLines) {
  const computedLines = draftLines.map((line) => calculateLine(line, form));

  return {
    ...form,
    computedLines,
  };
}

export function exportQuotation(payload, format) {
  if (!payload?.computedLines?.length) {
    return;
  }

  const html = buildQuotationHtml(payload);
  const fileBase = slugify(payload.quotationNo || payload.storeCode || payload.storeName || "quotation");

  if (format === "excel") {
    downloadBlob(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" }), `${fileBase}.xls`);
    return;
  }

  if (format === "pdf") {
    printHtmlDocument(html);
  }
}
