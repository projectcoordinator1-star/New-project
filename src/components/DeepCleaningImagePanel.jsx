import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEEP_CLEANING_ASSET_BASE_URL,
  deleteDeepCleaningEvidence,
  fetchDeepCleaningEvidence,
  getDeepCleaningImageUrl,
  uploadDeepCleaningEvidence,
} from "../services/deepCleaningEvidenceService";
import { buildDeepCleaningPptx } from "../utils/pptxExport";
import { normalizeOperationalState } from "../utils/stateGroups";

const MAX_DEEP_CLEANING_IMAGES = 5;

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
}

function getCurrentMonthKey(date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function getEvidenceMonth(monthValue) {
  return monthValue && monthValue !== "ALL_MONTHS" ? monthValue : getCurrentMonthKey();
}

function getStoreLabel(row) {
  const storeName = row.storeName || "Unnamed Store";
  const storeId = row.storeId || "No Store ID";
  return `${storeId} - ${storeName}`;
}

function slugify(value, fallback) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function getMonthSlug(monthValue) {
  const text = String(monthValue || "");

  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] = text.split("-");
    const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", { month: "short" }).toLowerCase();
    return `${monthName}-${year}`;
  }

  if (text === "ALL_MONTHS") {
    return `all-months-${new Date().getFullYear()}`;
  }

  return slugify(text, String(new Date().getFullYear()));
}

function normalizePathList(value) {
  return Array.isArray(value) ? value.filter(Boolean).slice(0, MAX_DEEP_CLEANING_IMAGES) : [];
}

function normalizeEvidenceEntry(entry = {}) {
  return {
    evidenceId: entry.evidence_id || entry.evidenceId,
    storeId: entry.store_id || entry.storeId,
    storeName: entry.store_name || entry.storeName,
    stateName: entry.state_name || entry.stateName || "--",
    location: entry.location || "--",
    monthKey: entry.month_key || entry.monthKey || "",
    beforeImagePaths: normalizePathList(entry.before_image_paths || entry.beforeImagePaths),
    afterImagePaths: normalizePathList(entry.after_image_paths || entry.afterImagePaths),
    remarks: entry.remarks || "",
    uploadedAt: entry.uploaded_at || entry.uploadedAt,
  };
}

function normalizeStoreOption(store, reportRow) {
  const storeStatus = store.status || store.lifecycleStatus || "";

  return {
    storeId: store.storeId,
    storeName: store.storeName || store.business || reportRow?.storeName || store.storeId,
    location: store.location || reportRow?.location || store.region || reportRow?.region || "--",
    region: store.region || store.state || reportRow?.region || "--",
    riskStatus: reportRow?.riskStatus || storeStatus || "--",
    cleaning: reportRow?.cleaning || {},
    server: store.server || "",
    business: store.business || "",
    storeStatus,
  };
}

function matchesOperationalFilters(store, filters = {}) {
  if (filters.storeId && filters.storeId !== "All" && store.storeId !== filters.storeId) return false;
  if (filters.location && filters.location !== "All" && store.location !== filters.location) return false;
  if (filters.region && filters.region !== "All" && normalizeOperationalState(store.region) !== filters.region) return false;
  if (filters.status && filters.status !== "All" && store.riskStatus !== filters.status) return false;

  if (filters.search?.trim()) {
    const searchText = `${store.storeId} ${store.storeName} ${store.location} ${store.region} ${store.server} ${store.business}`
      .toLowerCase()
      .trim();
    if (!searchText.includes(filters.search.trim().toLowerCase())) return false;
  }

  return true;
}

function buildStoreOptions(masterStores = [], reportRows = [], filters = {}) {
  const stores = new Map();
  const reportRowsByStore = new Map(reportRows.filter((row) => row?.storeId).map((row) => [row.storeId, row]));
  const sourceStores = masterStores.length ? masterStores : reportRows;

  sourceStores.forEach((store) => {
    if (!store?.storeId) return;

    const option = normalizeStoreOption(store, reportRowsByStore.get(store.storeId));
    if (!matchesOperationalFilters(option, filters)) return;
    stores.set(option.storeId, option);
  });

  return Array.from(stores.values()).sort((left, right) => getStoreLabel(left).localeCompare(getStoreLabel(right)));
}

function createPendingImage(file) {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

function getExportEntries(evidenceEntries, selectedStoreId) {
  const selectedStoreEntries = evidenceEntries.filter((entry) => entry.storeId === selectedStoreId);
  return selectedStoreEntries.length ? selectedStoreEntries : evidenceEntries;
}

function getImageColumns(paths, label) {
  return Object.fromEntries(
    Array.from({ length: MAX_DEEP_CLEANING_IMAGES }, (_, index) => [
      `${label} Image ${index + 1}`,
      paths[index] ? getDeepCleaningImageUrl(paths[index]) : "",
    ]),
  );
}

async function fetchImageAsDataUrl(imagePath) {
  const response = await fetch(
    `${DEEP_CLEANING_ASSET_BASE_URL}/api/deep-cleaning/image-data?path=${encodeURIComponent(imagePath)}`,
  );

  if (!response.ok) {
    throw new Error(`Unable to load deep cleaning image: ${response.status}`);
  }

  const payload = await response.json();
  return payload.dataUrl;
}

async function buildPptReportStores(entries, storeMap) {
  return Promise.all(
    entries.map(async (entry) => {
      const store = storeMap.get(entry.storeId) || {
        storeId: entry.storeId,
        storeName: entry.storeName,
        location: entry.location,
        region: entry.stateName,
      };

      const beforeImages = await Promise.all(
        entry.beforeImagePaths.map(async (imagePath, index) => ({
          dataUrl: await fetchImageAsDataUrl(imagePath),
          name: `Before Image ${index + 1}`,
          updatedAt: entry.uploadedAt,
        })),
      );
      const afterImages = await Promise.all(
        entry.afterImagePaths.map(async (imagePath, index) => ({
          dataUrl: await fetchImageAsDataUrl(imagePath),
          name: `After Image ${index + 1}`,
          updatedAt: entry.uploadedAt,
        })),
      );

      return {
        store,
        evidence: {
          beforeImages,
          afterImages,
        },
      };
    }),
  );
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function DeepCleaningImagePanel({ rows, masterStores = [], filters = {} }) {
  const [evidenceEntries, setEvidenceEntries] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [beforeImages, setBeforeImages] = useState([]);
  const [afterImages, setAfterImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPpt, setIsExportingPpt] = useState(false);
  const [panelMessage, setPanelMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const pendingImagesRef = useRef({ beforeImages: [], afterImages: [] });
  const storeOptions = useMemo(() => buildStoreOptions(masterStores, rows, filters), [filters, masterStores, rows]);
  const storeMap = useMemo(() => new Map(storeOptions.map((store) => [store.storeId, store])), [storeOptions]);
  const evidenceMonth = getEvidenceMonth(filters.month);

  useEffect(() => {
    let cancelled = false;

    async function loadEvidence() {
      setIsLoading(true);
      setUploadError("");
      try {
        const result = await fetchDeepCleaningEvidence({
          month: filters.month,
          storeId: filters.storeId,
          state: filters.region,
        });
        if (!cancelled) {
          setEvidenceEntries((result.data || []).map(normalizeEvidenceEntry));
        }
      } catch (error) {
        if (!cancelled) {
          setUploadError(error.message || "Unable to load saved deep cleaning evidence.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadEvidence();
    return () => {
      cancelled = true;
    };
  }, [filters.month, filters.region, filters.storeId]);

  useEffect(() => {
    if (!storeOptions.length) {
      setSelectedStoreId("");
      return;
    }

    setSelectedStoreId((current) => (current && storeOptions.some((store) => store.storeId === current) ? current : storeOptions[0].storeId));
  }, [storeOptions]);

  useEffect(() => {
    pendingImagesRef.current = { beforeImages, afterImages };
  }, [beforeImages, afterImages]);

  useEffect(() => {
    return () => {
      [...pendingImagesRef.current.beforeImages, ...pendingImagesRef.current.afterImages].forEach((image) =>
        URL.revokeObjectURL(image.previewUrl),
      );
    };
  }, []);

  const selectedStore = storeOptions.find((store) => store.storeId === selectedStoreId) || storeOptions[0] || null;
  const exportEntries = getExportEntries(evidenceEntries, selectedStore?.storeId);
  const storesWithEvidence = new Set(evidenceEntries.map((entry) => entry.storeId)).size;
  const uploadedImageCount = evidenceEntries.reduce(
    (total, entry) => total + entry.beforeImagePaths.length + entry.afterImagePaths.length,
    0,
  );

  function clearPendingImages() {
    [...beforeImages, ...afterImages].forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setBeforeImages([]);
    setAfterImages([]);
  }

  function handleImageUpload(side, event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;

    const invalidFile = files.find((file) => !file.type.startsWith("image/"));
    if (invalidFile) {
      setUploadError("Please upload JPG or PNG image files only.");
      return;
    }

    const setImages = side === "before" ? setBeforeImages : setAfterImages;
    const currentCount = side === "before" ? beforeImages.length : afterImages.length;
    const remainingSlots = MAX_DEEP_CLEANING_IMAGES - currentCount;

    if (remainingSlots <= 0) {
      setUploadError(`Maximum ${MAX_DEEP_CLEANING_IMAGES} ${side} images are allowed.`);
      return;
    }

    const acceptedFiles = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setUploadError(`Only ${remainingSlots} more ${side} image${remainingSlots === 1 ? "" : "s"} can be added.`);
    } else {
      setUploadError("");
    }

    setImages((current) => [...current, ...acceptedFiles.map(createPendingImage)]);
  }

  function handleRemovePendingImage(side, imageId) {
    const setImages = side === "before" ? setBeforeImages : setAfterImages;

    setImages((current) => {
      const imageToRemove = current.find((image) => image.id === imageId);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
      }
      return current.filter((image) => image.id !== imageId);
    });
  }

  async function refreshEvidence() {
    const result = await fetchDeepCleaningEvidence({
      month: filters.month,
      storeId: filters.storeId,
      state: filters.region,
    });
    setEvidenceEntries((result.data || []).map(normalizeEvidenceEntry));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedStore) {
      setUploadError("Please select a store before saving evidence.");
      return;
    }
    if (!beforeImages.length || !afterImages.length) {
      setUploadError("Please add at least one before image and one after image.");
      return;
    }

    setIsSaving(true);
    setUploadError("");
    setPanelMessage("");

    const formData = new FormData();
    formData.append("storeId", selectedStore.storeId);
    formData.append("storeName", selectedStore.storeName || selectedStore.storeId);
    formData.append("stateName", normalizeOperationalState(selectedStore.region));
    formData.append("location", selectedStore.location || "");
    formData.append("monthKey", evidenceMonth);
    formData.append("remarks", remarks);
    beforeImages.forEach((image) => formData.append("beforeImages", image.file));
    afterImages.forEach((image) => formData.append("afterImages", image.file));

    try {
      await uploadDeepCleaningEvidence(formData);
      setPanelMessage("Deep cleaning evidence saved successfully.");
      setRemarks("");
      clearPendingImages();
      await refreshEvidence();
    } catch (error) {
      setUploadError(error.message || "Unable to save deep cleaning evidence.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteEvidence(evidenceId) {
    if (!window.confirm("Delete this saved deep cleaning evidence?")) return;

    try {
      await deleteDeepCleaningEvidence(evidenceId);
      setPanelMessage("Deep cleaning evidence deleted.");
      await refreshEvidence();
    } catch (error) {
      setUploadError(error.message || "Unable to delete this evidence.");
    }
  }

  async function handleExportExcel() {
    if (!exportEntries.length) return;

    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const rowsForExcel = exportEntries.map((entry, index) => ({
      "Sl No": index + 1,
      Month: entry.monthKey,
      State: entry.stateName,
      Location: entry.location,
      "Store ID": entry.storeId,
      "Store Name": entry.storeName,
      Remarks: entry.remarks,
      "Uploaded At": formatDateTime(entry.uploadedAt),
      ...getImageColumns(entry.beforeImagePaths, "Before"),
      ...getImageColumns(entry.afterImagePaths, "After"),
    }));
    const worksheet = XLSX.utils.json_to_sheet(rowsForExcel);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 14 },
      { wch: 30 },
      { wch: 36 },
      { wch: 22 },
      ...Array.from({ length: MAX_DEEP_CLEANING_IMAGES * 2 }, () => ({ wch: 48 })),
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Deep Cleaning Evidence");

    const storeSlug = slugify(exportEntries.length === evidenceEntries.length ? "uploaded-stores" : selectedStore?.storeId, "uploaded-stores");
    XLSX.writeFile(workbook, `qpms-deep-cleaning-${storeSlug}-${getMonthSlug(filters.month)}.xlsx`);
  }

  async function handleExportPpt() {
    if (!exportEntries.length) return;

    setIsExportingPpt(true);
    setUploadError("");
    try {
      const reportStores = await buildPptReportStores(exportEntries, storeMap);
      const blob = buildDeepCleaningPptx(reportStores);
      const storeSlug = slugify(exportEntries.length === evidenceEntries.length ? "uploaded-stores" : selectedStore?.storeId, "uploaded-stores");
      downloadBlob(blob, `qpms-deep-cleaning-${storeSlug}-${getMonthSlug(filters.month)}.pptx`);
    } catch (error) {
      setUploadError(error.message || "Unable to export PPT.");
    } finally {
      setIsExportingPpt(false);
    }
  }

  return (
    <section className="panel panel--wide deep-cleaning-evidence-panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Image Evidence</p>
          <h3>Before and After Cleaning Photos</h3>
          <p>Select a Store Master row, add before/after photos, submit the evidence, then export saved records to Excel.</p>
        </div>
        <div className="deep-cleaning-evidence-panel__summary">
          <span>{storesWithEvidence} stores with saved images</span>
          <strong>{uploadedImageCount} photos saved</strong>
        </div>
      </div>

      <div className="deep-cleaning-evidence-controls">
        <label className="filter-field">
          <span>Store</span>
          <select value={selectedStore?.storeId || ""} onChange={(event) => setSelectedStoreId(event.target.value)} disabled={!storeOptions.length}>
            {storeOptions.length ? (
              storeOptions.map((store) => (
                <option key={store.storeId} value={store.storeId}>
                  {getStoreLabel(store)}
                </option>
              ))
            ) : (
              <option value="">No Store Master rows in current filter</option>
            )}
          </select>
        </label>

        <div className="deep-cleaning-evidence-actions">
          <button type="button" className="ghost-button" onClick={handleExportPpt} disabled={!exportEntries.length || isExportingPpt}>
            {isExportingPpt ? "Preparing PPT..." : "Export PPT"}
          </button>
          <button type="button" className="excel-button" onClick={handleExportExcel} disabled={!exportEntries.length}>
            Export Excel
          </button>
        </div>
      </div>

      {uploadError ? <div className="deep-cleaning-evidence-error">{uploadError}</div> : null}
      {panelMessage ? <div className="db-sync-status db-sync-status--success">{panelMessage}</div> : null}

      {selectedStore ? (
        <form className="deep-cleaning-evidence-form" onSubmit={handleSubmit}>
          <div className="deep-cleaning-evidence-form__meta">
            <div>
              <span>Evidence month</span>
              <strong>{evidenceMonth}</strong>
            </div>
            <label className="filter-field">
              <span>Remarks</span>
              <input
                type="text"
                placeholder="Optional notes for this cleaning evidence"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
              />
            </label>
          </div>

          <div className="deep-cleaning-evidence-grid">
            <ImageUploadCard
              title="Before Cleaning"
              side="before"
              assets={beforeImages}
              onUpload={(event) => handleImageUpload("before", event)}
              onRemove={(imageId) => handleRemovePendingImage("before", imageId)}
            />
            <ImageUploadCard
              title="After Cleaning"
              side="after"
              assets={afterImages}
              onUpload={(event) => handleImageUpload("after", event)}
              onRemove={(imageId) => handleRemovePendingImage("after", imageId)}
            />
          </div>

          <button type="submit" className="primary-button deep-cleaning-evidence-submit" disabled={isSaving}>
            {isSaving ? "Saving Evidence..." : "Submit and Save Evidence"}
          </button>
        </form>
      ) : (
        <div className="empty-state">
          <strong>No Store Master rows match the current filters.</strong>
          <p>Change the operational filters or add the store in Store Master before uploading images.</p>
        </div>
      )}

      <SavedEvidenceList
        entries={evidenceEntries}
        isLoading={isLoading}
        selectedStoreId={selectedStore?.storeId}
        onDelete={handleDeleteEvidence}
      />
    </section>
  );
}

function ImageUploadCard({ title, side, assets = [], onUpload, onRemove }) {
  return (
    <article className="cleaning-image-card">
      <div className="cleaning-image-card__header">
        <div>
          <h4>{title}</h4>
          <p>
            {assets.length
              ? `${assets.length}/${MAX_DEEP_CLEANING_IMAGES} selected`
              : `Select up to ${MAX_DEEP_CLEANING_IMAGES} ${side} images`}
          </p>
        </div>
      </div>

      <div className={`cleaning-image-card__gallery ${assets.length ? "" : "is-empty"}`}>
        {assets.length ? (
          assets.map((asset, index) => (
            <figure key={asset.id} className="cleaning-image-thumb">
              <img src={asset.previewUrl} alt={`${title} ${index + 1}`} />
              <figcaption>
                <span>{asset.file.name || `${title} ${index + 1}`}</span>
                <small>Ready to submit</small>
              </figcaption>
              <button type="button" className="cleaning-image-thumb__remove" onClick={() => onRemove(asset.id)}>
                Remove
              </button>
            </figure>
          ))
        ) : (
          <span>Upload {title.toLowerCase()} images</span>
        )}
      </div>

      <label className="upload-button cleaning-image-card__upload">
        <span>{assets.length ? "Add more images" : "Upload images"}</span>
        <strong>Select JPG or PNG photos</strong>
        <input type="file" accept="image/*" multiple onChange={onUpload} />
      </label>
    </article>
  );
}

function SavedEvidenceList({ entries, isLoading, selectedStoreId, onDelete }) {
  const visibleEntries = selectedStoreId ? entries.filter((entry) => entry.storeId === selectedStoreId) : entries;

  if (isLoading) {
    return (
      <div className="empty-state deep-cleaning-evidence-list">
        <strong>Loading saved evidence...</strong>
        <p>Fetching submitted before/after records from the database.</p>
      </div>
    );
  }

  if (!visibleEntries.length) {
    return (
      <div className="empty-state deep-cleaning-evidence-list">
        <strong>No saved evidence for this store yet.</strong>
        <p>Submit before and after images above, then export the saved records to Excel.</p>
      </div>
    );
  }

  return (
    <div className="deep-cleaning-evidence-list">
      <div className="training-section-title">
        <strong>Saved Deep Cleaning Evidence</strong>
        <span>{visibleEntries.length} submitted record{visibleEntries.length === 1 ? "" : "s"}</span>
      </div>
      {visibleEntries.map((entry) => (
        <article key={entry.evidenceId} className="deep-cleaning-evidence-entry">
          <div className="deep-cleaning-evidence-entry__header">
            <div>
              <strong>{entry.storeName}</strong>
              <span>
                {entry.storeId} | {entry.stateName} | {entry.monthKey || "--"}
              </span>
            </div>
            <button type="button" className="ghost-button" onClick={() => onDelete(entry.evidenceId)}>
              Delete
            </button>
          </div>
          {entry.remarks ? <p className="training-remarks">{entry.remarks}</p> : null}
          <div className="before-after-grid">
            <SavedImageStrip title="Before" paths={entry.beforeImagePaths} />
            <SavedImageStrip title="After" paths={entry.afterImagePaths} />
          </div>
          <div className="training-card-footer">
            <span>Submitted</span>
            <span>{formatDateTime(entry.uploadedAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function SavedImageStrip({ title, paths = [] }) {
  return (
    <div className="deep-cleaning-saved-strip">
      <strong>{title}</strong>
      <div>
        {paths.map((imagePath, index) => (
          <a key={`${imagePath}-${index}`} href={getDeepCleaningImageUrl(imagePath)} target="_blank" rel="noreferrer">
            <img src={getDeepCleaningImageUrl(imagePath)} alt={`${title} ${index + 1}`} />
          </a>
        ))}
      </div>
    </div>
  );
}
