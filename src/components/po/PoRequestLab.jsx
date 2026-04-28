import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { formatDisplayValue } from "../../utils/formatters";
import { buildQuotationPayload, exportQuotation } from "../../utils/quotationExports";
import { parseServiceMasterWorkbook, searchServiceMaster } from "../../utils/serviceMaster";
import { formatUomLabel, getUomRule, sanitizeQuantityValue } from "../../utils/uomRules";

const sampleQueries = ["push button", "tile", "tap", "partition", "cable"];

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function createInitialQuotationForm() {
  return {
    quotationDate: getTodayDate(),
    quotationNo: "",
    fmFaultNo: "",
    fmFaultDate: getTodayDate(),
    storeName: "",
    formatName: "",
    storeCode: "",
    category: "",
    companyCode: "",
    subject: "General Repair / Maintenance Work",
    gstRate: "18",
    vendorName: "QUALITY PROPERTY MANAGEMENT SERVICES PVT. LTD",
    vendorAddress: "No 85, Sulthan Building, Rayapuram Muthurangam Thero",
    vendorState: "Tamil Nadu",
    vendorStateCode: "33",
    vendorGstin: "",
    vendorCode: "",
    vendorMobile: "",
    vendorEmail: "",
    vendorContactPerson: "",
    billToName: "",
    billToAddress: "",
    billToState: "Tamil Nadu",
    billToGstin: "",
    shipToName: "",
    shipToAddress: "",
    shipToState: "Tamil Nadu",
    shipToGstin: "",
    paymentTerms: "1. Payment terms : 30 Days",
    warranty: "2. Warranty ( If applicable)",
    footerNote:
      "Terms & Conditions, This quotation is valid for a period of 30 days from the date of issue. Prices and availability of materials/services are subject to change beyond this period.",
    authorizedSignatory: "For QUALITY PROPERTY MANAGEMENT SERVICES PVT. LTD",
  };
}

function DetailItem({ label, value }) {
  return (
    <div className="po-lab__detail-item">
      <span>{label}</span>
      <strong>{value || "--"}</strong>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", placeholder = "", rows = 3 }) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      {type === "textarea" ? (
        <textarea value={value} rows={rows} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function buildResultText(items, query) {
  if (!query.trim()) {
    return "Type a few words like tile, push button, cable, or tap to start seeing matches.";
  }

  if (!items.length) {
    return "No service master matches yet. Try a shorter keyword or switch category.";
  }

  return `${items.length} suggestion${items.length === 1 ? "" : "s"} ready for review.`;
}

function createDraftLine(item, quantity, defaultGstRate) {
  return {
    id: `${item.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    serviceId: item.id,
    oldServiceCode: item.oldServiceCode,
    newServiceCode: item.newServiceCode,
    finalServiceCode: item.finalServiceCode,
    hsn: item.hsn,
    shortText: item.shortText,
    longText: item.longText,
    sapDescription: item.shortText,
    uom: item.uom,
    benchmarkRate: item.benchmarkRate,
    approvedBrand: item.approvedBrand === "NA" ? "" : item.approvedBrand,
    model: "",
    category: item.category,
    arcNo: item.oldServiceCode || "",
    arcLine: item.newServiceCode && item.newServiceCode !== "New Service code require" ? item.newServiceCode : "",
    quantity,
    managementFeesPct: "0",
    gstRate: defaultGstRate,
    remarks: item.remarks || "",
    additionalRemarks: "",
  };
}

export function PoRequestLab() {
  const [catalog, setCatalog] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState("1");
  const [draftLines, setDraftLines] = useState([]);
  const [quotationForm, setQuotationForm] = useState(() => createInitialQuotationForm());
  const deferredQuery = useDeferredValue(query);
  const suggestions = useMemo(
    () => (catalog ? searchServiceMaster(catalog.items, deferredQuery, category) : []),
    [catalog, deferredQuery, category],
  );
  const selectedUomRule = getUomRule(selectedItem?.uom);
  const selectedQuantity = Math.max(Number(sanitizeQuantityValue(quantity, selectedItem?.uom)) || 0, 0);
  const estimatedAmount = selectedItem ? selectedQuantity * (selectedItem.benchmarkRate || 0) : 0;
  const quotationPayload = useMemo(
    () => buildQuotationPayload(quotationForm, draftLines),
    [draftLines, quotationForm],
  );
  const computedDraftLines = quotationPayload.computedLines || [];
  const draftTotal = useMemo(
    () => computedDraftLines.reduce((sum, line) => sum + (Number(line.totalInclAmount) || 0), 0),
    [computedDraftLines],
  );

  useEffect(() => {
    if (selectedItem) {
      setQuantity(getUomRule(selectedItem.uom).defaultQuantity);
    }
  }, [selectedItem]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const nextCatalog = await parseServiceMasterWorkbook(file);
      setCatalog(nextCatalog);
      setCategory("All");
      setQuery("");
      setSelectedItem(nextCatalog.items[0] || null);
      setDraftLines([]);
      setQuantity("1");
    } catch (uploadError) {
      setCatalog(null);
      setSelectedItem(null);
      setDraftLines([]);
      setError(uploadError.message || "Unable to read the service master workbook.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleQuotationFormChange = (field, value) => {
    setQuotationForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleAddLineItem = () => {
    if (!selectedItem || !selectedQuantity) {
      return;
    }

    setDraftLines((current) => {
      const existingIndex = current.findIndex((line) => line.finalServiceCode === selectedItem.finalServiceCode);
      if (existingIndex >= 0) {
        const existingLine = current[existingIndex];
        const nextQuantity = sanitizeQuantityValue(
          (Number(existingLine.quantity) || 0) + selectedQuantity,
          selectedItem.uom,
        );

        return current.map((line, index) =>
          index === existingIndex
            ? {
                ...line,
                quantity: nextQuantity,
              }
            : line,
        );
      }

      return [...current, createDraftLine(selectedItem, selectedQuantity, quotationForm.gstRate)];
    });
    setQuantity(getUomRule(selectedItem.uom).defaultQuantity);
  };

  const handleDraftFieldChange = (lineId, field, value) => {
    setDraftLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              [field]: value,
            }
          : line,
      ),
    );
  };

  const handleDraftQuantityChange = (lineId, nextQuantity) => {
    setDraftLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              quantity: sanitizeQuantityValue(nextQuantity, line.uom),
            }
          : line,
      ),
    );
  };

  const handleRemoveLine = (lineId) => {
    setDraftLines((current) => current.filter((line) => line.id !== lineId));
  };

  return (
    <section className="po-lab">
      <section className="panel po-lab__intro">
        <div className="panel__header">
          <div>
            <p className="eyebrow">PO Prototype Lab</p>
            <h3>Upload the service master and test supervisor-style suggestions</h3>
            <p>
              This is a lightweight search bench for your service-code approach. Upload the Excel, type a fault keyword,
              and pick the closest service item before quantity entry.
            </p>
          </div>
        </div>

        <div className="po-lab__upload-row">
          <label className="upload-button upload-button--wide po-lab__upload">
            <span>Service Master Workbook</span>
            <strong>{catalog?.fileName || "Choose Excel file"}</strong>
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={isUploading} />
          </label>

          <div className="po-lab__summary-grid">
            <article className="data-source-card">
              <span className="data-source-card__label">Rows Loaded</span>
              <strong>{catalog?.summary.totalItems || 0}</strong>
              <p>Service lines available for suggestion matching.</p>
            </article>
            <article className="data-source-card">
              <span className="data-source-card__label">Categories</span>
              <strong>{catalog?.summary.totalCategories || 0}</strong>
              <p>Trade buckets like electrical, plumbing, and civil.</p>
            </article>
            <article className="data-source-card">
              <span className="data-source-card__label">HSN Codes</span>
              <strong>{catalog?.summary.totalHsnCodes || 0}</strong>
              <p>Commercial-side classification available for quotation creation.</p>
            </article>
          </div>
        </div>

        {catalog ? (
          <div className="filter-summary">
            <span className="filter-chip">
              <b>Sheet</b>
              {catalog.sheetName}
            </span>
            <span className="filter-chip">
              <b>Status</b>
              Ready for suggestion search
            </span>
            <span className="filter-chip">
              <b>Flow</b>
              Search item, add multiple lines, export quotation
            </span>
          </div>
        ) : null}

        {error ? <p className="upload-error">{error}</p> : null}
      </section>

      <section className="panel po-lab__quote-panel">
        <div className="panel__header">
          <div>
            <h3>Quotation Setup</h3>
            <p>These fields drive the exported quotation layout so it stays close to your current application format.</p>
          </div>
          <div className="panel__actions">
            <button
              type="button"
              className="ghost-button"
              disabled={!draftLines.length}
              onClick={() => exportQuotation(quotationPayload, "excel")}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!draftLines.length}
              onClick={() => exportQuotation(quotationPayload, "pdf")}
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="po-lab__quote-grid">
          <section className="po-lab__quote-card">
            <h4>Quotation + Store</h4>
            <div className="po-lab__quote-fields">
              <FormField label="Quotation Date" type="date" value={quotationForm.quotationDate} onChange={(value) => handleQuotationFormChange("quotationDate", value)} />
              <FormField label="Quotation No" value={quotationForm.quotationNo} onChange={(value) => handleQuotationFormChange("quotationNo", value)} placeholder="QPMSTN..." />
              <FormField label="FM Fault No" value={quotationForm.fmFaultNo} onChange={(value) => handleQuotationFormChange("fmFaultNo", value)} placeholder="FM fault ref" />
              <FormField label="FM Fault Date" type="date" value={quotationForm.fmFaultDate} onChange={(value) => handleQuotationFormChange("fmFaultDate", value)} />
              <FormField label="Store Name" value={quotationForm.storeName} onChange={(value) => handleQuotationFormChange("storeName", value)} />
              <FormField label="Format" value={quotationForm.formatName} onChange={(value) => handleQuotationFormChange("formatName", value)} />
              <FormField label="Store Code" value={quotationForm.storeCode} onChange={(value) => handleQuotationFormChange("storeCode", value)} />
              <FormField label="Category" value={quotationForm.category} onChange={(value) => handleQuotationFormChange("category", value)} />
              <FormField label="Company Code" value={quotationForm.companyCode} onChange={(value) => handleQuotationFormChange("companyCode", value)} />
              <FormField label="GST Rate" type="number" value={quotationForm.gstRate} onChange={(value) => handleQuotationFormChange("gstRate", value)} />
              <FormField
                label="Subject"
                type="textarea"
                rows={2}
                value={quotationForm.subject}
                onChange={(value) => handleQuotationFormChange("subject", value)}
              />
            </div>
          </section>

          <section className="po-lab__quote-card">
            <h4>Vendor Details</h4>
            <div className="po-lab__quote-fields">
              <FormField label="Vendor Name" value={quotationForm.vendorName} onChange={(value) => handleQuotationFormChange("vendorName", value)} />
              <FormField
                label="Vendor Address"
                type="textarea"
                rows={3}
                value={quotationForm.vendorAddress}
                onChange={(value) => handleQuotationFormChange("vendorAddress", value)}
              />
              <FormField label="Vendor State" value={quotationForm.vendorState} onChange={(value) => handleQuotationFormChange("vendorState", value)} />
              <FormField label="Vendor State Code" value={quotationForm.vendorStateCode} onChange={(value) => handleQuotationFormChange("vendorStateCode", value)} />
              <FormField label="Vendor GSTIN" value={quotationForm.vendorGstin} onChange={(value) => handleQuotationFormChange("vendorGstin", value)} />
              <FormField label="Vendor Code" value={quotationForm.vendorCode} onChange={(value) => handleQuotationFormChange("vendorCode", value)} />
              <FormField label="Mobile" value={quotationForm.vendorMobile} onChange={(value) => handleQuotationFormChange("vendorMobile", value)} />
              <FormField label="Email" value={quotationForm.vendorEmail} onChange={(value) => handleQuotationFormChange("vendorEmail", value)} />
              <FormField
                label="Vendor Contact Person"
                value={quotationForm.vendorContactPerson}
                onChange={(value) => handleQuotationFormChange("vendorContactPerson", value)}
              />
            </div>
          </section>

          <section className="po-lab__quote-card">
            <h4>Bill To / Ship To</h4>
            <div className="po-lab__party-grid">
              <div className="po-lab__party-card">
                <strong>Bill To</strong>
                <div className="po-lab__quote-fields">
                  <FormField label="Name" value={quotationForm.billToName} onChange={(value) => handleQuotationFormChange("billToName", value)} />
                  <FormField
                    label="Address"
                    type="textarea"
                    rows={3}
                    value={quotationForm.billToAddress}
                    onChange={(value) => handleQuotationFormChange("billToAddress", value)}
                  />
                  <FormField label="State" value={quotationForm.billToState} onChange={(value) => handleQuotationFormChange("billToState", value)} />
                  <FormField label="GSTIN" value={quotationForm.billToGstin} onChange={(value) => handleQuotationFormChange("billToGstin", value)} />
                </div>
              </div>

              <div className="po-lab__party-card">
                <strong>Ship To</strong>
                <div className="po-lab__quote-fields">
                  <FormField label="Name" value={quotationForm.shipToName} onChange={(value) => handleQuotationFormChange("shipToName", value)} />
                  <FormField
                    label="Address"
                    type="textarea"
                    rows={3}
                    value={quotationForm.shipToAddress}
                    onChange={(value) => handleQuotationFormChange("shipToAddress", value)}
                  />
                  <FormField label="State" value={quotationForm.shipToState} onChange={(value) => handleQuotationFormChange("shipToState", value)} />
                  <FormField label="GSTIN" value={quotationForm.shipToGstin} onChange={(value) => handleQuotationFormChange("shipToGstin", value)} />
                </div>
              </div>
            </div>

            <div className="po-lab__quote-fields po-lab__quote-fields--terms">
              <FormField
                label="Payment Terms"
                value={quotationForm.paymentTerms}
                onChange={(value) => handleQuotationFormChange("paymentTerms", value)}
              />
              <FormField label="Warranty" value={quotationForm.warranty} onChange={(value) => handleQuotationFormChange("warranty", value)} />
              <FormField
                label="Authorized Signatory Label"
                value={quotationForm.authorizedSignatory}
                onChange={(value) => handleQuotationFormChange("authorizedSignatory", value)}
              />
              <FormField
                label="Footer Note"
                type="textarea"
                rows={3}
                value={quotationForm.footerNote}
                onChange={(value) => handleQuotationFormChange("footerNote", value)}
              />
            </div>
          </section>
        </div>
      </section>

      <section className="po-lab__workspace">
        <section className="panel po-lab__search-panel">
          <div className="panel__header">
            <div>
              <h3>Search Suggestions</h3>
              <p>{buildResultText(suggestions, deferredQuery)}</p>
            </div>
          </div>

          <div className="po-lab__controls">
            <label className="filter-control">
              <span>Search item or fault</span>
              <input
                type="text"
                placeholder="Try push button, tile, partition, cable..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={!catalog}
              />
            </label>

            <label className="filter-control">
              <span>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)} disabled={!catalog}>
                <option value="All">All Categories</option>
                {(catalog?.summary.categories || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="po-lab__query-chips">
            {sampleQueries.map((item) => (
              <button type="button" key={item} className="pivot-mini-button" onClick={() => setQuery(item)} disabled={!catalog}>
                {item}
              </button>
            ))}
          </div>

          <div className="po-lab__suggestions">
            {catalog ? (
              suggestions.length ? (
                suggestions.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`po-suggestion ${selectedItem?.id === item.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="po-suggestion__header">
                      <strong>{item.shortText}</strong>
                      <span>{item.category}</span>
                    </div>
                    <div className="po-suggestion__meta">
                      <span>Code {item.finalServiceCode || item.oldServiceCode}</span>
                      <span>HSN {item.hsn || "--"}</span>
                      <span>UOM {item.uom || "--"}</span>
                      <span>Rate {formatDisplayValue(item.benchmarkRate, { fallback: "0" })}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="po-lab__empty">
                  <strong>No suggestion yet</strong>
                  <span>Upload the workbook and start with a short keyword to test the matching flow.</span>
                </div>
              )
            ) : (
              <div className="po-lab__empty">
                <strong>Workbook not loaded</strong>
                <span>Upload your service master first, then this area will show the live dropdown-style suggestions.</span>
              </div>
            )}
          </div>
        </section>

        <section className="panel po-lab__selection-panel">
          <div className="panel__header">
            <div>
              <h3>PO Draft Builder</h3>
              <p>One store can carry multiple problems, so this draft collects several service lines in one request.</p>
            </div>
          </div>

          {selectedItem ? (
            <>
              <div className="po-lab__selected-card">
                <div className="po-lab__selected-header">
                  <strong>{selectedItem.shortText}</strong>
                  <button type="button" className="primary-button po-lab__add-button" onClick={handleAddLineItem}>
                    Add Line Item
                  </button>
                </div>
                <p>{selectedItem.longText || "Long description not available in the workbook."}</p>
              </div>

              <div className="po-lab__detail-grid">
                <DetailItem label="Final Service Code" value={selectedItem.finalServiceCode} />
                <DetailItem label="Old Service Code" value={selectedItem.oldServiceCode} />
                <DetailItem label="HSN" value={selectedItem.hsn} />
                <DetailItem label="Category" value={selectedItem.category} />
                <DetailItem label="UOM" value={formatUomLabel(selectedItem.uom)} />
                <DetailItem label="Benchmark Rate" value={formatDisplayValue(selectedItem.benchmarkRate, { fallback: "0" })} />
              </div>

              <div className="po-lab__quantity-card">
                <label className="filter-control">
                  <span>Quantity ({selectedUomRule.code || "--"})</span>
                  <input
                    type="number"
                    min={selectedUomRule.min}
                    step={selectedUomRule.step}
                    value={quantity}
                    disabled={selectedUomRule.quantityMode === "fixed"}
                    onChange={(event) => setQuantity(sanitizeQuantityValue(event.target.value, selectedItem.uom))}
                  />
                  <small className="po-lab__quantity-help">{selectedUomRule.helper}</small>
                </label>

                <div className="po-lab__estimate">
                  <span>Estimated Amount</span>
                  <strong>{formatDisplayValue(estimatedAmount, { fallback: "0" })}</strong>
                  <small>
                    {formatDisplayValue(selectedQuantity, { fallback: "0" })} x{" "}
                    {formatDisplayValue(selectedItem.benchmarkRate, { fallback: "0" })} benchmark rate
                  </small>
                </div>
              </div>
            </>
          ) : (
            <div className="po-lab__empty">
              <strong>No item selected</strong>
              <span>Select one of the suggestions to preview how the PO line would auto-fill for MIS review.</span>
            </div>
          )}

          <div className="po-lab__draft-panel">
            <div className="po-lab__draft-header">
              <div>
                <h4>Draft Line Items</h4>
                <p>{draftLines.length ? `${draftLines.length} line item${draftLines.length === 1 ? "" : "s"} added` : "No issues added yet."}</p>
              </div>
              <div className="po-lab__draft-total">
                <span>Draft Total</span>
                <strong>{formatDisplayValue(draftTotal, { fallback: "0" })}</strong>
              </div>
            </div>

            {computedDraftLines.length ? (
              <div className="po-lab__draft-lines">
                {computedDraftLines.map((line) => (
                  <article key={line.id} className="po-draft-line">
                    <div className="po-draft-line__header">
                      <div>
                        <strong>{line.shortText}</strong>
                        <p>
                          Code {line.finalServiceCode || line.oldServiceCode} | HSN {line.hsn || "--"} | {line.category}
                        </p>
                      </div>
                      <button type="button" className="ghost-button po-draft-line__remove" onClick={() => handleRemoveLine(line.id)}>
                        Remove
                      </button>
                    </div>

                    <div className="po-draft-line__meta">
                      <DetailItem label="UOM" value={formatUomLabel(line.uom)} />
                      <DetailItem label="Rate" value={formatDisplayValue(line.rate, { fallback: "0" })} />
                      <label className="filter-control po-draft-line__quantity">
                        <span>Quantity ({getUomRule(line.uom).code || "--"})</span>
                        <input
                          type="number"
                          min={getUomRule(line.uom).min}
                          step={getUomRule(line.uom).step}
                          value={line.quantity}
                          disabled={getUomRule(line.uom).quantityMode === "fixed"}
                          onChange={(event) => handleDraftQuantityChange(line.id, event.target.value)}
                        />
                        <small className="po-lab__quantity-help">{getUomRule(line.uom).helper}</small>
                      </label>
                      <div className="po-draft-line__amount">
                        <span>Total Incl. GST</span>
                        <strong>{formatDisplayValue(line.totalInclAmount, { fallback: "0" })}</strong>
                      </div>
                    </div>

                    <div className="po-draft-line__edit-grid">
                      <FormField label="ARC No" value={line.arcNo || ""} onChange={(value) => handleDraftFieldChange(line.id, "arcNo", value)} />
                      <FormField label="ARC Line" value={line.arcLine || ""} onChange={(value) => handleDraftFieldChange(line.id, "arcLine", value)} />
                      <FormField
                        label="Approved Make / Brand"
                        value={line.approvedBrand || ""}
                        onChange={(value) => handleDraftFieldChange(line.id, "approvedBrand", value)}
                      />
                      <FormField label="Model" value={line.model || ""} onChange={(value) => handleDraftFieldChange(line.id, "model", value)} />
                      <FormField
                        label="Management Fees %"
                        type="number"
                        value={line.managementFeesPct || "0"}
                        onChange={(value) => handleDraftFieldChange(line.id, "managementFeesPct", value)}
                      />
                      <FormField
                        label="GST Rate"
                        type="number"
                        value={line.gstRate || quotationForm.gstRate}
                        onChange={(value) => handleDraftFieldChange(line.id, "gstRate", value)}
                      />
                    </div>

                    <div className="po-draft-line__text-grid">
                      <FormField
                        label="SAP Description"
                        type="textarea"
                        rows={3}
                        value={line.sapDescription || ""}
                        onChange={(value) => handleDraftFieldChange(line.id, "sapDescription", value)}
                      />
                      <FormField
                        label="Remarks"
                        type="textarea"
                        rows={3}
                        value={line.remarks || ""}
                        onChange={(value) => handleDraftFieldChange(line.id, "remarks", value)}
                      />
                      <FormField
                        label="Additional Remarks"
                        type="textarea"
                        rows={3}
                        value={line.additionalRemarks || ""}
                        onChange={(value) => handleDraftFieldChange(line.id, "additionalRemarks", value)}
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="po-lab__empty po-lab__empty--compact">
                <strong>Draft is empty</strong>
                <span>Pick a service from the left and use Add Line Item to build a multi-problem quotation request.</span>
              </div>
            )}
          </div>

          <div className="filter-summary">
            <span className="filter-chip">
              <b>Tax Logic</b>
              Same-state quotes split into SGST + CGST automatically
            </span>
            <span className="filter-chip">
              <b>Supervisor</b>
              Search and add all problems
            </span>
            <span className="filter-chip">
              <b>MIS</b>
              Validate commercial fields before export
            </span>
          </div>
        </section>
      </section>
    </section>
  );
}
