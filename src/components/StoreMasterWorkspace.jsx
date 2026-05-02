import { useMemo, useState } from "react";

const STATE_OPTIONS = ["AP-1", "AP-2", "KL", "KN", "TG", "TN"];

const initialForm = {
  storeCode: "",
  state: "TN",
  server: "",
  business: "",
  status: "Active",
};

function normalizeStatus(value) {
  return String(value || "").toLowerCase() === "inactive" ? "Inactive" : "Active";
}

function createEditForm(store = {}) {
  return {
    state: store.region || store.state || "TN",
    server: store.server || "",
    business: store.business || "",
    status: normalizeStatus(store.status),
  };
}

function StatusPill({ status }) {
  const normalized = normalizeStatus(status);
  return <span className={`store-status-pill store-status-pill--${normalized.toLowerCase()}`}>{normalized}</span>;
}

export function StoreMasterWorkspace({ stores = [], onAddStore, onStatusChange, onUpdateStore }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [sortBy, setSortBy] = useState("storeId");
  const [form, setForm] = useState(initialForm);
  const [formMessage, setFormMessage] = useState("");
  const [tableMessage, setTableMessage] = useState("");
  const [pendingCode, setPendingCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState("");
  const [editForm, setEditForm] = useState(() => createEditForm());

  const normalizedStores = useMemo(
    () =>
      stores.map((store) => ({
        ...store,
        status: normalizeStatus(store.status),
      })),
    [stores],
  );

  const stateOptions = useMemo(() => {
    const dynamicStates = [...new Set(normalizedStores.map((store) => store.region).filter(Boolean))];
    return ["All", ...dynamicStates.sort((left, right) => left.localeCompare(right))];
  }, [normalizedStores]);

  const editableStateOptions = useMemo(() => {
    const dynamicStates = normalizedStores.map((store) => store.region).filter(Boolean);
    return [...new Set([...STATE_OPTIONS, ...dynamicStates])].sort((left, right) => left.localeCompare(right));
  }, [normalizedStores]);

  const filteredStores = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const byFilters = normalizedStores.filter((store) => {
      if (statusFilter !== "All" && store.status !== statusFilter) return false;
      if (stateFilter !== "All" && store.region !== stateFilter) return false;
      if (!needle) return true;
      return `${store.storeId} ${store.region} ${store.server} ${store.business} ${store.status}`.toLowerCase().includes(needle);
    });

    const sorted = [...byFilters].sort((left, right) => {
      if (sortBy === "status") {
        if (left.status === right.status) return left.storeId.localeCompare(right.storeId);
        return left.status.localeCompare(right.status);
      }
      if (sortBy === "state") {
        return `${left.region}-${left.storeId}`.localeCompare(`${right.region}-${right.storeId}`);
      }
      if (sortBy === "business") {
        return `${left.business}-${left.storeId}`.localeCompare(`${right.business}-${right.storeId}`);
      }
      return left.storeId.localeCompare(right.storeId);
    });

    return sorted;
  }, [normalizedStores, search, sortBy, stateFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = normalizedStores.filter((store) => store.status === "Active").length;
    const inactive = normalizedStores.length - active;
    const states = new Set(normalizedStores.map((store) => store.region).filter(Boolean)).size;
    const businessTypes = new Set(normalizedStores.map((store) => store.business).filter(Boolean)).size;

    return { active, inactive, states, businessTypes };
  }, [normalizedStores]);

  const handleFormChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setFormMessage("");

    try {
      await onAddStore(form);
      setForm(initialForm);
      setFormMessage(`Store ${form.storeCode.trim()} added to master data.`);
    } catch (error) {
      setFormMessage(error.message || "Unable to add store.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (store) => {
    const nextStatus = store.status === "Active" ? "Inactive" : "Active";
    setPendingCode(store.storeId);
    setTableMessage("");

    try {
      await onStatusChange(store.storeId, nextStatus);
      setTableMessage(`Store ${store.storeId} marked ${nextStatus}.`);
    } catch (error) {
      setTableMessage(error.message || "Unable to update store status.");
    } finally {
      setPendingCode("");
    }
  };

  const handleStartEdit = (store) => {
    setEditingStoreId(store.storeId);
    setEditForm(createEditForm(store));
    setTableMessage("");
  };

  const handleEditChange = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
    setTableMessage("");
  };

  const handleCancelEdit = () => {
    setEditingStoreId("");
    setEditForm(createEditForm());
    setTableMessage("");
  };

  const handleSaveEdit = async (store) => {
    setPendingCode(store.storeId);
    setTableMessage("");

    try {
      await onUpdateStore(store.storeId, editForm);
      setEditingStoreId("");
      setTableMessage(`Store ${store.storeId} details updated.`);
    } catch (error) {
      setTableMessage(error.message || "Unable to update store details.");
    } finally {
      setPendingCode("");
    }
  };

  return (
    <section className="store-master-workspace">
      <div className="store-master-controls">
        <label className="store-master-control-group">
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder="Store code, state, server, business..."
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="store-master-control-group">
          <span>Status</span>
          <div className="store-master-status-tabs">
            {["All", "Active", "Inactive"].map((item) => (
              <button
                key={item}
                type="button"
                className={statusFilter === item ? "store-tab is-active" : "store-tab"}
                onClick={() => setStatusFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <label className="store-master-control-group">
          <span>State</span>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            {stateOptions.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>

        <label className="store-master-control-group">
          <span>Sort by</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="storeId">Store Code</option>
            <option value="state">State</option>
            <option value="business">Business</option>
            <option value="status">Status</option>
          </select>
        </label>
      </div>

      <div className="store-master-grid">
        <form className="store-add-card" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Add Store</p>
            <h3>Create master row</h3>
          </div>

          <label>
            <span>Store Code</span>
            <input
              value={form.storeCode}
              placeholder="Example: T123"
              required
              onChange={(event) => handleFormChange("storeCode", event.target.value.toUpperCase())}
            />
          </label>

          <label>
            <span>State</span>
            <select value={form.state} onChange={(event) => handleFormChange("state", event.target.value)}>
              {STATE_OPTIONS.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Server</span>
            <input value={form.server} placeholder="419 / 451" onChange={(event) => handleFormChange("server", event.target.value)} />
          </label>

          <label>
            <span>Business</span>
            <input
              value={form.business}
              placeholder="Reliance Trends"
              required
              onChange={(event) => handleFormChange("business", event.target.value)}
            />
          </label>

          <label>
            <span>Status</span>
            <select value={form.status} onChange={(event) => handleFormChange("status", event.target.value)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>

          <button type="submit" className="excel-button" disabled={isSaving}>
            {isSaving ? "Saving..." : "Add Store"}
          </button>

          {formMessage ? <p className="store-master-message">{formMessage}</p> : null}
        </form>

        <div className="store-master-results">
          <div className="store-stat-strip">
            <div>
              <strong>{normalizedStores.length}</strong>
              <span>Total Stores</span>
            </div>
            <div>
              <strong>{stats.active}</strong>
              <span>Active</span>
            </div>
            <div>
              <strong>{stats.inactive}</strong>
              <span>Inactive</span>
            </div>
            <div>
              <strong>{stats.states}</strong>
              <span>States</span>
            </div>
            <div>
              <strong>{stats.businessTypes}</strong>
              <span>Business Types</span>
            </div>
          </div>

          {tableMessage ? <p className="store-master-message store-master-message--table">{tableMessage}</p> : null}

          <div className="store-master-table-wrap">
            <table className="data-table store-master-table">
              <thead>
                <tr>
                  <th>Store Code</th>
                  <th>State</th>
                  <th>Server</th>
                  <th>Business</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.map((store) => {
                  const isEditing = editingStoreId === store.storeId;
                  const isPending = pendingCode === store.storeId;

                  return (
                    <tr key={store.storeId} className={isEditing ? "store-master-row--editing" : undefined}>
                      <td>
                        <strong>{store.storeId}</strong>
                        {isEditing ? <span className="store-code-lock">Locked</span> : null}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="store-master-inline-field"
                            value={editForm.state}
                            onChange={(event) => handleEditChange("state", event.target.value)}
                          >
                            {editableStateOptions.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                          </select>
                        ) : (
                          store.region
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className="store-master-inline-field"
                            value={editForm.server}
                            placeholder="419 / 451"
                            onChange={(event) => handleEditChange("server", event.target.value)}
                          />
                        ) : (
                          store.server || "--"
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className="store-master-inline-field"
                            value={editForm.business}
                            placeholder="Business"
                            onChange={(event) => handleEditChange("business", event.target.value)}
                          />
                        ) : (
                          store.business || "--"
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="store-master-inline-field"
                            value={editForm.status}
                            onChange={(event) => handleEditChange("status", event.target.value)}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        ) : (
                          <StatusPill status={store.status} />
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="store-master-row-actions">
                            <button
                              type="button"
                              className="excel-button store-master-action-button"
                              disabled={isPending}
                              onClick={() => handleSaveEdit(store)}
                            >
                              {isPending ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              className="ghost-button store-master-action-button"
                              disabled={isPending}
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="store-master-row-actions">
                            <button
                              type="button"
                              className="ghost-button store-master-action-button"
                              disabled={isPending}
                              onClick={() => handleStartEdit(store)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={`${store.status === "Active" ? "danger-light-button" : "ghost-button"} store-master-action-button`}
                              disabled={isPending}
                              onClick={() => handleToggleStatus(store)}
                            >
                              {isPending ? "Updating..." : store.status === "Active" ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!filteredStores.length ? (
            <div className="empty-state">
              <strong>No stores found.</strong>
              <p>Try a different store code, state, server, or business search.</p>
            </div>
          ) : null}

          {filteredStores.length ? (
            <div className="store-master-footnote">
              Showing <strong>{filteredStores.length}</strong> of <strong>{normalizedStores.length}</strong> stores.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
