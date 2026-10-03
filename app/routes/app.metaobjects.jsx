import ActionButton from "../components/ActionButton";
import { useEffect, useState, useCallback } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import TypedValueInput from "../components/TypedValueInput";
import { editableValueType } from "../value-types";
import { PageIntro, HelpLink } from "../components/Workspace";
import { LoadingState } from "../components/LoadingState";
import SearchableSelect from "../components/SearchableSelect";
import { fieldTypeOption } from "../field-presentation";
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
  const definitions = Array.isArray(catalog.data?.definitions)
      ? catalog.data.definitions
      : [],
    definition = definitions.find((d) => d.id === definitionId);
  const types = (
    Array.isArray(catalog.data?.types) ? catalog.data.types : []
  ).filter((t) => editableValueType(t.name));
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
    definition &&
    entries.data?.type === definition.type &&
    Array.isArray(entries.data?.nodes)
      ? entries.data.nodes
      : [];
  const fieldLimit = catalog.data?.plan?.limits?.metaobjectFields || 25;
  const canPublish = catalog.data?.plan?.features?.publicMetaobjects === true;
  return (
    <s-page heading="Reusable metaobjects">
      <PageIntro
        eyebrow="Reusable content"
        title="Build once. Use across your store."
        description="Turn size guides, ingredients, FAQs and product stories into structured content you can reuse."
      >
        <HelpLink topic="metaobjects">Metaobjects guide</HelpLink>
      </PageIntro>
      {!catalog.data && (
        <LoadingState
          label="Loading your definitions and field types…"
          skeleton
        />
      )}
      {catalog.data?.error && (
        <div className="vsn-notice error" role="alert">
          {catalog.data.error}{" "}
          <HelpLink topic="recovery">Troubleshooting</HelpLink>
        </div>
      )}
      {ready && !definitions.length && (
        <div className="vsn-empty">
          <h3>Your first reusable content collection</h3>
          <p>
            Create a definition below, then add entries. For example, a Size
            guide with Title, Size and Fit notes.
          </p>
          <HelpLink topic="metaobjects">See the step-by-step guide</HelpLink>
        </div>
      )}
      <s-section heading="Definition">
        {ready && !canPublish && (
          <div className="vsn-notice warning">
            Your plan includes private draft metaobjects. Pro unlocks public
            access and saving Active public entries.{" "}
            <HelpLink topic="plans">Compare Pro features</HelpLink>
          </div>
        )}
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
          <s-option
            value="PUBLIC_READ"
            disabled={
              !canPublish && definition?.access?.storefront !== "PUBLIC_READ"
            }
          >
            Public API access {!canPublish ? "· Pro" : ""}
          </s-option>
        </s-select>
        {!definition && (
          <>
            <s-text>
              {fields.length} / {fieldLimit} fields in this definition. Type and
              key stay fixed after creation.
            </s-text>
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
                <SearchableSelect
                  label="Field type"
                  value={field.type}
                  onChange={(value) => updateField(index, "type", value)}
                  options={types.map(fieldTypeOption)}
                />
                <s-checkbox
                  label="Required"
                  checked={field.required}
                  onChange={(e) =>
                    updateField(index, "required", e.target.checked)
                  }
                />
                <details>
                  <summary>Advanced validations</summary>
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
                </details>
                <ActionButton
                  disabled={fields.length === 1 || busy}
                  onClick={() =>
                    setFields((f) => f.filter((_, i) => i !== index))
                  }
                >
                  Remove field
                </ActionButton>
              </s-box>
            ))}
            <ActionButton
              disabled={fields.length >= fieldLimit || busy || !ready}
              onClick={() =>
                setFields((f) => {
                  let next = 1;
                  while (f.some((field) => field.key === `field_${next}`))
                    next++;
                  return [
                    ...f,
                    {
                      ...initialField(),
                      key: `field_${next}`,
                      name: `Field ${next}`,
                      required: false,
                    },
                  ];
                })
              }
            >
              Add field
            </ActionButton>
          </>
        )}
        <ActionButton
          variant="primary"
          loading={busy}
          disabled={!ready || busy || (definition && !definition.editable)}
          onClick={() => {
            if (definition) {
              const widening =
                storefront === "PUBLIC_READ" &&
                definition.access?.storefront !== "PUBLIC_READ";
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
        </ActionButton>
        {definition && (
          <>
            <s-text>
              Shopify reports {definition.metaobjectsCount} entries. Removal
              checks current entries again. Type/key changes and destructive
              field migrations use Shopify’s native editor.
            </s-text>
            <ActionButton
              tone="critical"
              disabled={busy || !definition.editable}
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
            </ActionButton>
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
                referencesLoading={references.state !== "idle"}
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
              <s-option
                value="ACTIVE"
                disabled={
                  !canPublish && definition.access?.storefront === "PUBLIC_READ"
                }
              >
                Active{" "}
                {definition.access?.storefront === "PUBLIC_READ" && !canPublish
                  ? "· Pro"
                  : ""}
              </s-option>
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
          <ActionButton
            variant="primary"
            loading={busy}
            disabled={
              busy ||
              !definition.editable ||
              (definition.access?.storefront === "PUBLIC_READ" &&
                (status === "ACTIVE" ||
                  !definition.capabilities?.publishable?.enabled) &&
                !canPublish) ||
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
          </ActionButton>
          {editing && (
            <ActionButton
              onClick={() => {
                setEditing(null);
                setValues({});
                setHandle("");
                setStatus("DRAFT");
                setPublicConfirm(false);
              }}
            >
              Cancel edit
            </ActionButton>
          )}
        </s-section>
      )}
      {definition && (
        <s-section heading="Entries">
          {entries.state !== "idle" && (
            <LoadingState label="Loading entries…" />
          )}
          {entries.state === "idle" &&
            entries.data?.ok &&
            entries.data.type === definition.type &&
            !selectedEntries.length && (
              <div className="vsn-empty">
                <h3>No entries on this page</h3>
                <p>
                  Add your first entry above or reload from the first page. New
                  content starts as a draft.
                </p>
              </div>
            )}
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
                    <ActionButton
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
                    </ActionButton>
                    <ActionButton
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
                    </ActionButton>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
          {entries.data?.type === definition.type &&
            entries.data.pageInfo?.hasNextPage && (
              <ActionButton
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
              </ActionButton>
            )}
          <ActionButton
            onClick={() => loadEntries(url({ type: definition.type }))}
          >
            Reload from first page
          </ActionButton>
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
