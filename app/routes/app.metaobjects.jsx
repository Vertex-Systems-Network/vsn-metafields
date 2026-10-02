import { useEffect, useState, useCallback } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import TypedValueInput from "../components/TypedValueInput";
import { editableValueType } from "../value-types";
const initialField = () => ({
  key: "title",
  name: "Title",
  type: "single_line_text_field",
  required: true,
  validations: [],
});
export default function Metaobjects() {
  const catalog = useFetcher(),
    entries = useFetcher(),
    mutation = useFetcher(),
    references = useFetcher(),
    location = useLocation();
  const [definitionId, setDefinitionId] = useState(""),
    [name, setName] = useState(""),
    [type, setType] = useState(""),
    [description, setDescription] = useState(""),
    [storefront, setStorefront] = useState("NONE"),
    [fields, setFields] = useState([initialField()]);
  const [editing, setEditing] = useState(null),
    [handle, setHandle] = useState(""),
    [values, setValues] = useState({}),
    [status, setStatus] = useState("DRAFT"),
    [publicConfirm, setPublicConfirm] = useState(false);
  const url = useCallback(
    (params = {}) => {
      const search = new URLSearchParams(location.search);
      for (const [k, v] of Object.entries(params)) search.set(k, v);
      return `/app/api/metaobjects?${search}`;
    },
    [location.search],
  );
  const load = catalog.load,
    loadEntries = entries.load;
  const definitions = catalog.data?.definitions || [],
    definition = definitions.find((d) => d.id === definitionId);
  const types = (catalog.data?.types || []).filter((t) =>
    editableValueType(t.name),
  );
  useEffect(() => {
    load(url());
  }, [load, url]);
  useEffect(() => {
    if (definition) loadEntries(url({ type: definition.type }));
  }, [definition, loadEntries, url]);
  useEffect(() => {
    if (mutation.data?.success) {
      load(url());
      setEditing(null);
      setValues({});
      setHandle("");
      setPublicConfirm(false);
    }
  }, [mutation.data, load, url]);
  const busy = mutation.state !== "idle",
    ready = catalog.state === "idle" && catalog.data?.ok;
  const submit = (input) =>
    mutation.submit(input, {
      method: "post",
      encType: "application/json",
      action: url(),
    });
  const updateField = (index, key, value) =>
    setFields((current) =>
      current.map((f, i) => (i === index ? { ...f, [key]: value } : f)),
    );
  const select = (id) => {
    setDefinitionId(id);
    setEditing(null);
    setHandle("");
    setValues({});
    setStatus("DRAFT");
    setPublicConfirm(false);
    const d = definitions.find((item) => item.id === id);
    setName(d?.name || "");
    setDescription(d?.description || "");
    setStorefront(d?.access?.storefront || "NONE");
  };
  const selectedEntries =
    entries.data?.type === definition?.type ? entries.data.nodes || [] : [];
  return (
    <s-page heading="Reusable metaobjects">
      <s-section heading="Definition">
        <s-select
          label="Definition"
          value={definitionId}
          onInput={(e) => select(e.target.value)}
        >
          <s-option value="">Create a definition</s-option>
          {definitions.map((d) => (
            <s-option key={d.id} value={d.id}>
              {d.name} ({d.type}){d.editable ? "" : " · read only"}
            </s-option>
          ))}
        </s-select>
        <s-text-field
          label="Name"
          value={name}
          onInput={(e) => setName(e.target.value)}
        />
        {!definition && (
          <s-text-field
            label="Merchant-owned type"
            value={type}
            onInput={(e) => setType(e.target.value)}
          />
        )}
        <s-text-area
          label="Description"
          value={description}
          onInput={(e) => setDescription(e.target.value)}
        />
        <s-select
          label="Storefront access"
          value={storefront}
          onInput={(e) => setStorefront(e.target.value)}
        >
          <s-option value="NONE">Private</s-option>
          <s-option value="PUBLIC_READ">Public API access</s-option>
        </s-select>
        {!definition && (
          <>
            {fields.map((field, index) => (
              <s-box key={index} padding="base" borderWidth="base">
                <s-text-field
                  label={`Field ${index + 1} key`}
                  value={field.key}
                  onInput={(e) => updateField(index, "key", e.target.value)}
                />
                <s-text-field
                  label={`Field ${index + 1} label`}
                  value={field.name}
                  onInput={(e) => updateField(index, "name", e.target.value)}
                />
                <s-select
                  label="Field type"
                  value={field.type}
                  onInput={(e) => updateField(index, "type", e.target.value)}
                >
                  {types.map((t) => (
                    <s-option key={t.name} value={t.name}>
                      {t.name}
                    </s-option>
                  ))}
                </s-select>
                <s-checkbox
                  label="Required"
                  checked={field.required}
                  onChange={(e) =>
                    updateField(index, "required", e.target.checked)
                  }
                />
                <s-text-area
                  label="Validations JSON (optional)"
                  value={
                    typeof field.validations === "string"
                      ? field.validations
                      : JSON.stringify(field.validations)
                  }
                  onInput={(e) =>
                    updateField(index, "validations", e.target.value)
                  }
                />
                <s-button
                  disabled={fields.length === 1 || busy}
                  onClick={() =>
                    setFields((f) => f.filter((_, i) => i !== index))
                  }
                >
                  Remove field
                </s-button>
              </s-box>
            ))}
            <s-button
              disabled={fields.length >= 25 || busy}
              onClick={() =>
                setFields((f) => [
                  ...f,
                  {
                    ...initialField(),
                    key: `field_${f.length + 1}`,
                    name: `Field ${f.length + 1}`,
                    required: false,
                  },
                ])
              }
            >
              Add field
            </s-button>
          </>
        )}
        <s-button
          disabled={!ready || busy || (definition && !definition.editable)}
          onClick={() => {
            if (definition) {
              const widening =
                storefront === "PUBLIC_READ" &&
                definition.access?.storefront !== "PUBLIC_READ" &&
                definition.metaobjectsCount > 0;
              if (
                widening &&
                !window.confirm(
                  "Enable public access for this definition’s existing active entries? Review their content first.",
                )
              )
                return;
              submit({
                action: "updateDefinition",
                definitionId,
                type: definition.type,
                name,
                description,
                storefront,
                confirmPublicAccess: widening
                  ? `PUBLIC_ACCESS:${definition.id}:${definition.type}`
                  : "",
              });
            } else {
              let parsed;
              try {
                parsed = fields.map((f) => ({
                  ...f,
                  validations:
                    typeof f.validations === "string"
                      ? JSON.parse(f.validations)
                      : f.validations,
                }));
              } catch {
                window.alert("Enter valid validations JSON.");
                return;
              }
              submit({
                action: "createDefinition",
                name,
                type,
                description,
                storefront,
                fields: parsed,
              });
            }
          }}
        >
          {definition ? "Save metadata" : "Create definition"}
        </s-button>
        {definition && (
          <>
            <s-text>
              Shopify reports {definition.metaobjectsCount} entries. Removal
              checks current entries again. Type/key changes and
              destructive field migrations use Shopify’s native editor.
            </s-text>
            <s-button
              tone="critical"
              disabled={
                busy ||
                !definition.editable
              }
              onClick={() => {
                if (
                  window.confirm(`Remove empty definition ${definition.type}?`)
                )
                  submit({
                    action: "deleteDefinition",
                    definitionId,
                    type: definition.type,
                    confirm: `DELETE_EMPTY_DEFINITION:${definitionId}:${definition.type}`,
                  });
              }}
            >
              Check and remove empty definition
            </s-button>
          </>
        )}
      </s-section>
      {definition && (
        <s-section heading={editing ? "Edit entry" : "Create an entry"}>
          <s-text-field
            label="Handle"
            value={handle}
            onInput={(e) => {
              setHandle(e.target.value);
              setPublicConfirm(false);
            }}
          />
          {definition.fieldDefinitions.map((field) => (
            <s-box key={`${definitionId}:${field.key}`} padding="base">
              <s-heading>
                {field.name}
                {field.required ? " *" : ""}
              </s-heading>
              <TypedValueInput
                type={field.type.name}
                value={values[field.key] || ""}
                onChange={(value) =>
                  setValues((v) => ({ ...v, [field.key]: value }))
                }
                references={
                  references.data?.type ===
                  field.type.name.replace(/^list\./, "")
                    ? references.data.references || []
                    : []
                }
                onFindReferences={(refType, search) => {
                  const p = new URLSearchParams(location.search);
                  p.set("type", refType);
                  p.set("search", search);
                  references.load(`/app/api/references?${p}`);
                }}
              />
            </s-box>
          ))}
          {definition.capabilities?.publishable?.enabled && (
            <s-select
              label="Publish status"
              value={status}
              onInput={(e) => {
                setStatus(e.target.value);
                setPublicConfirm(false);
              }}
            >
              <s-option value="DRAFT">Draft</s-option>
              <s-option value="ACTIVE">Active</s-option>
            </s-select>
          )}
          {status === "ACTIVE" &&
            definition.access?.storefront === "PUBLIC_READ" && (
              <s-checkbox
                label="Publish this entry as public content"
                checked={publicConfirm}
                onChange={(e) => setPublicConfirm(e.target.checked)}
              />
            )}
          <s-button
            disabled={
              busy ||
              !definition.editable ||
              (status === "ACTIVE" &&
                definition.access?.storefront === "PUBLIC_READ" &&
                !publicConfirm)
            }
            onClick={() =>
              submit({
                action: "saveEntry",
                definitionId,
                type: definition.type,
                id: editing?.id,
                updatedAt: editing?.updatedAt,
                handle,
                values,
                status,
                confirmPublic: publicConfirm
                  ? `PUBLISH:${definition.type}:${handle}`
                  : "",
              })
            }
          >
            Save entry
          </s-button>
          {editing && (
            <s-button
              onClick={() => {
                setEditing(null);
                setValues({});
                setHandle("");
                setStatus("DRAFT");
                setPublicConfirm(false);
              }}
            >
              Cancel edit
            </s-button>
          )}
        </s-section>
      )}
      {definition && (
        <s-section heading="Entries">
          <s-table>
            <s-table-header-row>
              <s-table-header>Entry</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {selectedEntries.map((entry) => (
                <s-table-row key={entry.id}>
                  <s-table-cell>
                    {entry.displayName || entry.handle}
                  </s-table-cell>
                  <s-table-cell>
                    {entry.capabilities?.publishable?.status ||
                      "Not publishable"}
                  </s-table-cell>
                  <s-table-cell>
                    <s-button
                      disabled={busy || !definition.editable}
                      onClick={() => {
                        setEditing(entry);
                        setHandle(entry.handle);
                        setValues(
                          Object.fromEntries(
                            entry.fields.map((f) => [f.key, f.value || ""]),
                          ),
                        );
                        setStatus(
                          entry.capabilities?.publishable?.status || "DRAFT",
                        );
                        setPublicConfirm(false);
                      }}
                    >
                      Edit
                    </s-button>
                    <s-button
                      tone="critical"
                      disabled={busy || !definition.editable}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${entry.handle}? References may become empty.`,
                          )
                        )
                          submit({
                            action: "deleteEntry",
                            definitionId,
                            type: definition.type,
                            id: entry.id,
                            updatedAt: entry.updatedAt,
                            confirm: `DELETE_ENTRY:${entry.id}:${entry.handle}`,
                          });
                      }}
                    >
                      Remove
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
          {entries.data?.type === definition.type &&
            entries.data.pageInfo?.hasNextPage && (
              <s-button
                onClick={() =>
                  loadEntries(
                    url({
                      type: definition.type,
                      after: entries.data.pageInfo.endCursor,
                    }),
                  )
                }
              >
                Next entries
              </s-button>
            )}
          <s-button onClick={() => loadEntries(url({ type: definition.type }))}>
            Reload from first page
          </s-button>
        </s-section>
      )}
      {[catalog, entries, mutation, references].map((f, i) =>
        f.data?.error ? (
          <s-banner key={i} tone="critical">
            {f.data.error}
          </s-banner>
        ) : null,
      )}
      {mutation.data?.success && (
        <s-banner tone="success">{mutation.data.message}</s-banner>
      )}
      <Link to={{ pathname: "/app/guide", search: location.search }}>
        Setup and recovery guidance
      </Link>
    </s-page>
  );
}
