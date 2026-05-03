import { useEffect, useMemo, useRef, useState } from "react";
import { deleteEvidence, fetchEvidence, fetchTrainingOptions, uploadEvidence } from "../services/trainingService";

const TRAINING_ASSET_BASE_URL = "http://localhost:8787";
const MAX_TRAINING_IMAGES = 5;
const TN_FIELD_OFFICERS = ["Naresh", "Dharani", "Kesavan"];
const FIELD_OFFICERS_BY_STATE = {
  TN: TN_FIELD_OFFICERS,
};

const emptyForm = {
  stateName: "",
  fieldOffice: "",
  employeeIdInput: "",
  employeeIds: [],
  storeId: "",
  title: "",
  remarks: "",
};

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function normalizeStateKey(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (["TN", "TAMIL NADU", "TAMILNADU"].includes(normalized)) return "TN";
  return normalized;
}

function getFieldOfficersForState(stateName) {
  return FIELD_OFFICERS_BY_STATE[normalizeStateKey(stateName)] || [];
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

function normalizeStore(row = {}) {
  const storeId = String(firstPresent(row.store_id, row.storeId, row.store_code, row.storeCode, "")).trim();
  const stateName = String(
    firstPresent(row.state_name, row.stateName, row.state_group, row.stateGroup, row.state, row.region, "Unknown"),
  ).trim();
  const storeName = String(firstPresent(row.store_name, row.storeName, row.name, storeId)).trim();

  return {
    storeId,
    storeName,
    stateName,
    location: String(firstPresent(row.location, row.city, row.region, stateName, "--")).trim(),
    city: String(firstPresent(row.city, row.location, "")).trim(),
    region: String(firstPresent(row.region, row.state_group, row.stateName, stateName, "")).trim(),
    formatName: String(firstPresent(row.format_name, row.formatName, "")).trim(),
    serverCode: String(firstPresent(row.server_code, row.serverCode, "")).trim(),
  };
}

function getStoreOptionLabel(store) {
  return store ? `${store.storeName} (${store.storeId})` : "";
}

function findStoreFromSearchValue(stores, value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;

  return (
    stores.find((store) =>
      [store.storeId, store.storeName, getStoreOptionLabel(store)].some((candidate) => String(candidate || "").trim().toLowerCase() === normalized),
    ) || null
  );
}

function getImageUrl(imagePath) {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `${TRAINING_ASSET_BASE_URL}${imagePath}`;
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchImageAsDataUrl(imagePath) {
  const response = await fetch(
    `${TRAINING_ASSET_BASE_URL}/api/training/image-data?path=${encodeURIComponent(imagePath)}`,
  );
  if (!response.ok) {
    throw new Error(`Unable to load image for PPT export: ${response.status}`);
  }
  const payload = await response.json();
  return payload.dataUrl;
}

function getEvidenceImagePaths(item = {}) {
  if (Array.isArray(item.image_paths) && item.image_paths.length > 0) {
    return item.image_paths.filter(Boolean).slice(0, MAX_TRAINING_IMAGES);
  }
  return item.image_path ? [item.image_path] : [];
}

function groupEvidenceByFieldOffice(items) {
  return items.reduce((groups, item) => {
    const fieldOffice = item.field_office || "Unassigned FO";
    if (!groups[fieldOffice]) groups[fieldOffice] = [];
    groups[fieldOffice].push(item);
    return groups;
  }, {});
}

function safeExportName(value) {
  return String(value || "all")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeSheetName(value) {
  const name = String(value || "Unassigned FO").replace(/[\\/?*[\]:]/g, " ").trim();
  return (name || "Unassigned FO").slice(0, 31);
}

function getEmployeeIdsText(item = {}) {
  if (Array.isArray(item.employee_ids)) {
    return item.employee_ids.filter(Boolean).join(", ");
  }
  return String(item.employee_id || "").trim();
}

function getStoreCodeSummary(items = [], fallback = "All") {
  const storeCodes = uniqueSorted(items.map((item) => item.store_id));
  if (storeCodes.length === 0) return fallback;
  if (storeCodes.length <= 4) return storeCodes.join(", ");
  return `${storeCodes.slice(0, 4).join(", ")} +${storeCodes.length - 4} more`;
}

function getPptImageLayouts(count) {
  if (count <= 1) {
    return [{ x: 0.75, y: 1.12, w: 11.85, h: 5.75 }];
  }

  if (count === 2) {
    return [
      { x: 0.75, y: 1.15, w: 5.85, h: 5.65 },
      { x: 6.85, y: 1.15, w: 5.85, h: 5.65 },
    ];
  }

  if (count === 3) {
    return [
      { x: 0.75, y: 1.15, w: 5.85, h: 2.75 },
      { x: 6.85, y: 1.15, w: 5.85, h: 2.75 },
      { x: 3.8, y: 4.12, w: 5.85, h: 2.75 },
    ];
  }

  if (count === 4) {
    return [
      { x: 0.75, y: 1.15, w: 5.85, h: 2.75 },
      { x: 6.85, y: 1.15, w: 5.85, h: 2.75 },
      { x: 0.75, y: 4.12, w: 5.85, h: 2.75 },
      { x: 6.85, y: 4.12, w: 5.85, h: 2.75 },
    ];
  }

  return [
    { x: 0.55, y: 1.15, w: 4.0, h: 2.75 },
    { x: 4.75, y: 1.15, w: 4.0, h: 2.75 },
    { x: 8.95, y: 1.15, w: 4.0, h: 2.75 },
    { x: 2.65, y: 4.12, w: 4.0, h: 2.75 },
    { x: 6.85, y: 4.12, w: 4.0, h: 2.75 },
  ].slice(0, count);
}

function splitEmployeeInput(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeValues(values = []) {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });

  return result;
}

function employeeIdLabel(value) {
  return String(value || "").trim();
}

function compactEmployeeIds(ids = []) {
  return dedupeValues(ids.map(employeeIdLabel).filter(Boolean));
}

function getPptImageSizing(layout) {
  return { type: "cover", x: layout.x, y: layout.y, w: layout.w, h: layout.h };
}

function preventEnterSubmit(event) {
  if (event.key === "Enter") {
    event.preventDefault();
  }
}

export function TechnicalTrainingWorkspace({ stores: initialStores = [] }) {
  const [evidenceList, setEvidenceList] = useState([]);
  const [dbStores, setDbStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStoreLoading, setIsStoreLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExportingPpt, setIsExportingPpt] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const selectedImagesRef = useRef([]);

  const [activeFilters, setActiveFilters] = useState({
    state: "All",
    fieldOffice: "All",
    storeId: "All",
  });

  const [form, setForm] = useState(emptyForm);
  const [storeSearchText, setStoreSearchText] = useState("");

  const normalizedInitialStores = useMemo(
    () => initialStores.map(normalizeStore).filter((store) => store.storeId),
    [initialStores],
  );

  const stores = useMemo(
    () => (dbStores.length > 0 ? dbStores : normalizedInitialStores),
    [dbStores, normalizedInitialStores],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadStoreOptions() {
      setIsStoreLoading(true);
      try {
        const optionsRes = await fetchTrainingOptions();
        if (!isMounted) return;
        const mappedStores = (optionsRes.data || []).map(normalizeStore).filter((store) => store.storeId);
        setDbStores(mappedStores);
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsStoreLoading(false);
        }
      }
    }

    loadStoreOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadEvidence() {
      setIsLoading(true);
      setError("");
      try {
        const evidenceRes = await fetchEvidence(activeFilters);
        if (isMounted) {
          setEvidenceList(evidenceRes.data || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadEvidence();
    return () => {
      isMounted = false;
    };
  }, [activeFilters]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  const allStates = useMemo(() => uniqueSorted(stores.map((store) => store.stateName)), [stores]);

  const storeRowsForActiveState = useMemo(() => {
    if (activeFilters.state === "All") return stores;
    return stores.filter((store) => store.stateName === activeFilters.state);
  }, [activeFilters.state, stores]);

  const filterOptions = useMemo(() => {
    const fieldOffices =
      activeFilters.state === "All"
        ? uniqueSorted(Object.values(FIELD_OFFICERS_BY_STATE).flat())
        : getFieldOfficersForState(activeFilters.state);

    return {
      states: allStates,
      offices: fieldOffices,
      storeIds: uniqueSorted(storeRowsForActiveState.map((store) => store.storeId)),
    };
  }, [activeFilters.state, allStates, storeRowsForActiveState]);

  const formOptions = useMemo(() => {
    const offices = form.stateName ? getFieldOfficersForState(form.stateName) : [];
    const formStores = form.stateName ? stores.filter((store) => store.stateName === form.stateName) : [];

    return {
      states: allStates,
      offices,
      stores: formStores,
    };
  }, [allStates, form.stateName, stores]);

  const selectedStoreForForm = useMemo(
    () => stores.find((store) => store.storeId === form.storeId),
    [form.storeId, stores],
  );

  useEffect(() => {
    if (selectedStoreForForm) {
      setStoreSearchText(getStoreOptionLabel(selectedStoreForForm));
    }
  }, [selectedStoreForForm]);

  const handleFilterChange = (field, value) => {
    setActiveFilters((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "state") {
        next.fieldOffice = "All";
        next.storeId = "All";
      }
      if (field === "fieldOffice") {
        next.storeId = "All";
      }
      return next;
    });
  };

  const handleFormChange = (field, value) => {
    if (field === "stateName") {
      setStoreSearchText("");
    }

    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "stateName") {
        next.fieldOffice = "";
        next.storeId = "";
      }
      return next;
    });
  };

  const handleStoreSearchChange = (value) => {
    setStoreSearchText(value);
    const selectedStore = findStoreFromSearchValue(formOptions.stores, value);
    handleFormChange("storeId", selectedStore?.storeId || "");
  };

  const handleAddEmployeeId = () => {
    const nextEmployeeIds = splitEmployeeInput(form.employeeIdInput);
    if (!nextEmployeeIds.length) return;

    setForm((prev) => ({
      ...prev,
      employeeIdInput: "",
      employeeIds: compactEmployeeIds([...prev.employeeIds, ...nextEmployeeIds]),
    }));
  };

  const handleRemoveEmployeeId = (employeeId) => {
    setForm((prev) => ({
      ...prev,
      employeeIds: prev.employeeIds.filter((item) => item !== employeeId),
    }));
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setSelectedImages((prev) => {
      const remainingSlots = MAX_TRAINING_IMAGES - prev.length;
      if (remainingSlots <= 0) {
        setError(`Maximum ${MAX_TRAINING_IMAGES} images are allowed for one training entry.`);
        return prev;
      }

      const acceptedFiles = files.slice(0, remainingSlots);
      if (files.length > remainingSlots) {
        setError(`Only ${remainingSlots} more image${remainingSlots === 1 ? "" : "s"} can be added. Maximum is ${MAX_TRAINING_IMAGES}.`);
      } else {
        setError("");
      }

      return [
        ...prev,
        ...acceptedFiles.map((file) => ({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ];
    });

    event.target.value = "";
  };

  const removeSelectedImage = (imageId) => {
    setSelectedImages((prev) => {
      const imageToRemove = prev.find((image) => image.id === imageId);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
      }
      return prev.filter((image) => image.id !== imageId);
    });
  };

  const clearSelectedImages = () => {
    selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setSelectedImages([]);
    const input = document.getElementById("training-file-input");
    if (input) input.value = "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (selectedImages.length === 0) {
      setError("Please select at least one image to upload.");
      return;
    }
    if (selectedImages.length > MAX_TRAINING_IMAGES) {
      setError(`Maximum ${MAX_TRAINING_IMAGES} images are allowed for one training entry.`);
      return;
    }
    if (!selectedStoreForForm) {
      setError("Please select a valid store from the store master.");
      return;
    }

    setIsUploading(true);
    setError("");
    setSuccess("");

    const employeeIdsForSubmit = compactEmployeeIds([...form.employeeIds, ...splitEmployeeInput(form.employeeIdInput)]);
    const formData = new FormData();
    formData.append("stateName", form.stateName);
    formData.append("fieldOffice", form.fieldOffice);
    formData.append("employeeId", employeeIdsForSubmit.join(", "));
    formData.append("storeId", form.storeId);
    formData.append("storeName", selectedStoreForForm.storeName || form.storeId);
    formData.append("title", form.title);
    formData.append("remarks", form.remarks);
    selectedImages.forEach((image) => {
      formData.append("images", image.file);
    });

    try {
      await uploadEvidence(formData);
      setSuccess("Training evidence uploaded successfully.");
      setForm((prev) => ({
        ...prev,
        employeeIdInput: "",
        employeeIds: employeeIdsForSubmit,
      }));
      clearSelectedImages();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (evidenceId) => {
    if (!window.confirm("Delete this training evidence?")) return;

    try {
      await deleteEvidence(evidenceId);
      setEvidenceList((prev) => prev.filter((item) => item.evidence_id !== evidenceId));
      setSuccess("Evidence deleted successfully.");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportFoSheet = async () => {
    if (evidenceList.length === 0) return;

    setError("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const groupedByFo = groupEvidenceByFieldOffice(evidenceList);

      Object.entries(groupedByFo).forEach(([fieldOffice, items]) => {
        const rows = items.map((item, index) => {
          const imagePaths = getEvidenceImagePaths(item);
          return {
            "Sl No": index + 1,
            State: item.state_name || "",
            "Field Officer": item.field_office || "",
            "Employee IDs": getEmployeeIdsText(item),
            "Store ID": item.store_id || "",
            "Store Name": item.store_name || "",
            "Training Title": item.title || "",
            Remarks: item.remarks || "",
            "Uploaded At": formatDateTime(item.uploaded_at),
            "Image 1": imagePaths[0] ? getImageUrl(imagePaths[0]) : "",
            "Image 2": imagePaths[1] ? getImageUrl(imagePaths[1]) : "",
            "Image 3": imagePaths[2] ? getImageUrl(imagePaths[2]) : "",
            "Image 4": imagePaths[3] ? getImageUrl(imagePaths[3]) : "",
            "Image 5": imagePaths[4] ? getImageUrl(imagePaths[4]) : "",
          };
        });
        const worksheet = XLSX.utils.json_to_sheet(rows);
        worksheet["!cols"] = [
          { wch: 8 },
          { wch: 12 },
          { wch: 18 },
          { wch: 16 },
          { wch: 14 },
          { wch: 28 },
          { wch: 30 },
          { wch: 36 },
          { wch: 22 },
          { wch: 46 },
          { wch: 46 },
          { wch: 46 },
          { wch: 46 },
          { wch: 46 },
        ];
        XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(fieldOffice));
      });

      const selectedFo = activeFilters.fieldOffice === "All" ? "all-field-officers" : safeExportName(activeFilters.fieldOffice);
      XLSX.writeFile(workbook, `technical-training-${selectedFo}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      setError(err.message || "Unable to export FO sheet.");
    }
  };

  const handleExportPptx = async () => {
    const PptxGenJS = window.PptxGenJS;
    if (!PptxGenJS) {
      setError("PPTX export library is not loaded yet. Please refresh once and try again.");
      return;
    }
    if (evidenceList.length === 0) return;

    setIsExportingPpt(true);
    setError("");

    try {
      const imageDataCache = new Map();
      const getCachedImageData = async (imagePath) => {
        if (!imageDataCache.has(imagePath)) {
          imageDataCache.set(imagePath, fetchImageAsDataUrl(imagePath));
        }
        return imageDataCache.get(imagePath);
      };

      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      const storeCodeSummary = activeFilters.storeId === "All" ? getStoreCodeSummary(evidenceList) : activeFilters.storeId;

      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: "173252" };
      titleSlide.addText("Technical Training Evidence Report", {
        x: 0.8,
        y: 2,
        w: 11.8,
        h: 0.8,
        fontSize: 34,
        color: "FFFFFF",
        align: "center",
        bold: true,
      });
      titleSlide.addText(
        `Store Code: ${storeCodeSummary}`,
        {
          x: 0.8,
          y: 3.25,
          w: 11.8,
          h: 0.4,
          fontSize: 15,
          color: "D8E4F1",
          align: "center",
        },
      );
      titleSlide.addText(`Generated on: ${new Date().toLocaleDateString()}`, {
        x: 0.8,
        y: 4.1,
        w: 11.8,
        h: 0.35,
        fontSize: 12,
        color: "D8E4F1",
        align: "center",
      });

      for (const [, items] of Object.entries(groupEvidenceByFieldOffice(evidenceList))) {
        for (const item of items) {
          const imagePaths = getEvidenceImagePaths(item);
          const layouts = getPptImageLayouts(Math.max(imagePaths.length, 1));
          const slide = pptx.addSlide();
          slide.background = { color: "F6FAFF" };
          slide.addText(item.title || "Technical Training Evidence", {
            x: 0.45,
            y: 0.22,
            w: 12.4,
            h: 0.45,
            fontSize: 22,
            bold: true,
            color: "173252",
          });
          const employeeIdsText = getEmployeeIdsText(item);
          slide.addText(`${item.state_name || "--"} | ${item.field_office || "--"} | ${employeeIdsText || item.store_name || "--"}`, {
            x: 0.45,
            y: 0.75,
            w: 12.4,
            h: 0.3,
            fontSize: 11,
            color: "5B7089",
          });

          if (imagePaths.length === 0) {
            slide.addText("No image attached to this evidence entry.", {
              x: 0.75,
              y: 2.75,
              w: 12,
              h: 0.35,
              fontSize: 15,
              color: "70839B",
              align: "center",
            });
          }

          for (const [index, imagePath] of imagePaths.entries()) {
            const layout = layouts[index];
            try {
              const imageData = await getCachedImageData(imagePath);
              slide.addImage({
                data: imageData,
                ...layout,
                sizing: getPptImageSizing(layout),
              });
            } catch (err) {
              slide.addText("Image could not be loaded", {
                x: layout.x,
                y: layout.y + layout.h / 2 - 0.12,
                w: layout.w,
                h: 0.25,
                fontSize: 10,
                color: "B42318",
                align: "center",
              });
            }
          }

          if (item.remarks) {
            slide.addText(item.remarks, {
              x: 0.65,
              y: 6.65,
              w: 12,
              h: 0.32,
              fontSize: 11,
              italic: true,
              color: "22324A",
              align: "center",
            });
          }
          slide.addText(`Uploaded: ${formatDateTime(item.uploaded_at)}`, {
            x: 0.65,
            y: 7.08,
            w: 12,
            h: 0.25,
            fontSize: 9,
            color: "70839B",
            align: "right",
          });
        }
      }

      const selectedFo = activeFilters.fieldOffice === "All" ? "all-field-officers" : safeExportName(activeFilters.fieldOffice);
      const fileName = `technical-training-${selectedFo}-${new Date().toISOString().slice(0, 10)}.pptx`;
      await pptx.writeFile({ fileName });
    } catch (err) {
      setError(err.message || "Unable to export PPT.");
    } finally {
      setIsExportingPpt(false);
    }
  };

  return (
    <div className="technical-training-workspace">
      <section className="training-hero">
        <div>
          <p className="eyebrow">Technical Training</p>
          <h2>Evidence Management</h2>
          <p>
            Upload and review training evidence by state, field officer, and store. Store and state details are sourced
            from the store master DB, and each entry can hold up to 5 images.
          </p>
        </div>
        <div className="training-hero__actions">
          <span className="training-pill">{isStoreLoading ? "Loading stores" : `${stores.length} DB stores`}</span>
        </div>
      </section>

      {error && <div className="db-sync-status db-sync-status--error">{error}</div>}
      {success && <div className="db-sync-status db-sync-status--success">{success}</div>}

      <div className="training-layout">
        <section className="sync-workbench sync-workbench--primary training-card-panel">
          <div className="sync-workbench__header">
            <div>
              <p className="eyebrow">Upload</p>
              <h3>New Training Entry</h3>
              <p>TN field officers are temporarily limited to Naresh, Dharani, and Kesavan.</p>
              <p>One training entry can include up to {MAX_TRAINING_IMAGES} images.</p>
            </div>
          </div>

          <form className="training-form" onSubmit={handleSubmit}>
            <div className="training-field-grid">
              <label className="training-field">
                <span>State</span>
                <select required value={form.stateName} onChange={(event) => handleFormChange("stateName", event.target.value)}>
                  <option value="">Select state</option>
                  {formOptions.states.map((stateName) => (
                    <option key={stateName} value={stateName}>
                      {stateName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="training-field">
                <span>Field Officer</span>
                <select
                  required
                  value={form.fieldOffice}
                  disabled={!form.stateName || formOptions.offices.length === 0}
                  onChange={(event) => handleFormChange("fieldOffice", event.target.value)}
                >
                  <option value="">{form.stateName ? "Select field officer" : "Select state first"}</option>
                  {formOptions.offices.map((office) => (
                    <option key={office} value={office}>
                      {office}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="training-field">
              <span>Employee IDs</span>
              <div className="training-employee-input-row">
                <input
                  value={form.employeeIdInput}
                  placeholder="Type employee ID"
                  onKeyDown={preventEnterSubmit}
                  onChange={(event) => handleFormChange("employeeIdInput", event.target.value)}
                />
                <button type="button" className="ghost-button" onClick={handleAddEmployeeId}>
                  Add
                </button>
              </div>
              {form.employeeIds.length > 0 ? (
                <div className="training-employee-chip-row">
                  {form.employeeIds.map((employeeId) => (
                    <span key={employeeId} className="training-employee-chip">
                      {employeeId}
                      <button type="button" onClick={() => handleRemoveEmployeeId(employeeId)}>
                        Remove
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </label>

            <label className="training-field">
              <span>Store</span>
              <input
                required
                type="search"
                list="training-store-options"
                value={storeSearchText}
                disabled={!form.stateName}
                placeholder={form.stateName ? "Type or select store" : "Select state first"}
                onChange={(event) => handleStoreSearchChange(event.target.value)}
              />
              <datalist id="training-store-options">
                {formOptions.stores.map((store) => (
                  <option key={store.storeId} value={getStoreOptionLabel(store)} />
                ))}
              </datalist>
            </label>

            {form.stateName && formOptions.offices.length === 0 && (
              <div className="training-note">
                Field officer mapping is currently configured only for TN. Store selection still comes from the DB.
              </div>
            )}

            {selectedStoreForForm && (
              <div className="training-selected-store">
                <strong>{selectedStoreForForm.storeName}</strong>
                <span>
                  {selectedStoreForForm.storeId} | {selectedStoreForForm.stateName} | {selectedStoreForForm.location}
                </span>
              </div>
            )}

            <label className="training-field">
              <span>Evidence Title</span>
              <input
                required
                placeholder="Example: Electrical safety training"
                value={form.title}
                onChange={(event) => handleFormChange("title", event.target.value)}
              />
            </label>

            <label className="training-field">
              <span>Remarks</span>
              <textarea
                placeholder="Add outcome notes or observations..."
                rows={3}
                value={form.remarks}
                onChange={(event) => handleFormChange("remarks", event.target.value)}
              />
            </label>

            <div className={`training-upload-zone ${selectedImages.length > 0 ? "has-preview" : ""}`}>
              {selectedImages.length > 0 && (
                <div className="training-preview-grid">
                  {selectedImages.map((image, index) => (
                    <figure key={image.id} className="training-preview-thumb">
                      <img src={image.previewUrl} alt={`Selected training evidence ${index + 1}`} />
                      <figcaption>
                        <span>Image {index + 1}</span>
                        <button type="button" onClick={() => removeSelectedImage(image.id)}>
                          Remove
                        </button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
              {selectedImages.length < MAX_TRAINING_IMAGES && (
                <button type="button" className="training-upload-prompt" onClick={() => document.getElementById("training-file-input")?.click()}>
                  <strong>{selectedImages.length === 0 ? "Select training images" : "Add more images"}</strong>
                  <span>
                    {selectedImages.length}/{MAX_TRAINING_IMAGES} selected. PNG or JPG evidence from the session.
                  </span>
                </button>
              )}
              <input id="training-file-input" type="file" accept="image/*" multiple onChange={handleFileChange} />
            </div>

            <button type="submit" className="primary-button training-submit" disabled={isUploading || selectedImages.length === 0}>
              {isUploading ? "Uploading..." : "Submit Evidence"}
            </button>
          </form>
        </section>

        <section className="sync-workbench training-card-panel">
          <div className="sync-workbench__header">
            <div>
              <p className="eyebrow">Explorer</p>
              <h3>Operational Filters</h3>
              <p>Field officer filtering is TN-only until the all-state FO mapping is available.</p>
            </div>
            <div className="training-export-actions">
              <button className="ghost-button" onClick={handleExportFoSheet} disabled={evidenceList.length === 0}>
                Export FO Sheet
              </button>
              <button className="primary-button" onClick={handleExportPptx} disabled={evidenceList.length === 0 || isExportingPpt}>
                {isExportingPpt ? "Preparing PPT..." : "Export PPT"}
              </button>
            </div>
          </div>

          <div className="training-filter-grid">
            <label className="training-field">
              <span>State</span>
              <select value={activeFilters.state} onChange={(event) => handleFilterChange("state", event.target.value)}>
                <option value="All">All States</option>
                {filterOptions.states.map((stateName) => (
                  <option key={stateName} value={stateName}>
                    {stateName}
                  </option>
                ))}
              </select>
            </label>

            <label className="training-field">
              <span>Field Officer</span>
              <select
                value={activeFilters.fieldOffice}
                disabled={filterOptions.offices.length === 0}
                onChange={(event) => handleFilterChange("fieldOffice", event.target.value)}
              >
                <option value="All">All Field Officers</option>
                {filterOptions.offices.map((office) => (
                  <option key={office} value={office}>
                    {office}
                  </option>
                ))}
              </select>
            </label>

            <label className="training-field">
              <span>Store</span>
              <select value={activeFilters.storeId} onChange={(event) => handleFilterChange("storeId", event.target.value)}>
                <option value="All">All Stores</option>
                {filterOptions.storeIds.map((storeId) => {
                  const store = stores.find((item) => item.storeId === storeId);
                  return (
                    <option key={storeId} value={storeId}>
                      {store?.storeName || storeId} ({storeId})
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <div className="training-summary-grid">
            <div className="training-summary-card training-summary-card--blue">
              <span>Total Evidence</span>
              <strong>{evidenceList.length}</strong>
              <small>Records in current filter</small>
            </div>
            <div className="training-summary-card">
              <span>Store Master</span>
              <strong>{stores.length}</strong>
              <small>Active stores from DB</small>
            </div>
            <div className="training-summary-card">
              <span>States</span>
              <strong>{allStates.length}</strong>
              <small>Available in store master</small>
            </div>
            <div className="training-summary-card">
              <span>TN Field Officers</span>
              <strong>{TN_FIELD_OFFICERS.length}</strong>
              <small>Temporary code mapping</small>
            </div>
          </div>

        </section>
      </div>

      <section className="training-gallery">
        <div className="training-gallery__header">
          <div>
            <p className="eyebrow">Gallery</p>
            <h3>Training Evidence</h3>
          </div>
          <span>Sorted by most recent</span>
        </div>

        {isLoading ? (
          <div className="empty-state training-empty">
            <strong>Loading evidence repository...</strong>
            <p>Fetching the latest training images from the DB.</p>
          </div>
        ) : evidenceList.length === 0 ? (
          <div className="empty-state training-empty">
            <strong>No training evidence found.</strong>
            <p>Try another filter or upload the first evidence image for this state and store.</p>
          </div>
        ) : (
          <div className="training-gallery-grid">
            {evidenceList.map((item) => {
              const imagePaths = getEvidenceImagePaths(item);
              const firstImageUrl = getImageUrl(imagePaths[0]);

              return (
                <article key={item.evidence_id} className="training-evidence-card">
                  <div className={`training-evidence-card__image training-evidence-card__image--count-${Math.min(imagePaths.length, MAX_TRAINING_IMAGES)}`}>
                    {imagePaths.length > 0 ? (
                      imagePaths.map((imagePath, index) => (
                        <button
                          key={`${item.evidence_id}-${imagePath}`}
                          type="button"
                          className="training-evidence-image-tile"
                          onClick={() => window.open(getImageUrl(imagePath), "_blank")}
                        >
                          <img src={getImageUrl(imagePath)} alt={`${item.title || "Training evidence"} ${index + 1}`} />
                        </button>
                      ))
                    ) : (
                      <div className="training-image-placeholder">No image</div>
                    )}
                    <span className="training-image-count">{imagePaths.length} image{imagePaths.length === 1 ? "" : "s"}</span>
                    <div className="training-evidence-card__actions">
                      <button type="button" disabled={!firstImageUrl} onClick={() => window.open(firstImageUrl, "_blank")}>
                        View
                      </button>
                      <button type="button" className="is-danger" onClick={() => handleDelete(item.evidence_id)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="training-evidence-card__body">
                    <div className="training-chip-row">
                      <span>{item.state_name || "--"}</span>
                      <span>{item.field_office || "--"}</span>
                    </div>
                    <h4>{item.title || "Training evidence"}</h4>
                    <p className="training-store-line">
                      {item.store_name || "--"} <span>({item.store_id || "--"})</span>
                    </p>
                    {getEmployeeIdsText(item) && <p className="training-store-line">Employee IDs <span>{getEmployeeIdsText(item)}</span></p>}
                    {item.remarks && <p className="training-remarks">{item.remarks}</p>}
                    <div className="training-card-footer">
                      <span>Uploaded</span>
                      <span>{formatDateTime(item.uploaded_at)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
