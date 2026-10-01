import { useCallback, useEffect, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  OWNER_TYPES,
  PUBLIC_OWNERS,
  VALUE_OWNERS,
  METAFIELD_API_VERSION,
} from "../metafield-capabilities.js";
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session.shop };
};

export default function Index() {
  const statusFetcher = useFetcher();
  const fieldsFetcher = useFetcher();
  const standardsFetcher = useFetcher();
  const actionFetcher = useFetcher();
  const resourcesFetcher = useFetcher();
  const valueFetcher = useFetcher();
  const valueActionFetcher = useFetcher();
  const location = useLocation();
  const [ownerType, setOwnerType] = useState("PRODUCT");
  const [name, setName] = useState("");
  const [namespace, setNamespace] = useState("vsn_metafields");
  const [key, setKey] = useState("");
  const [type, setType] = useState("single_line_text_field");
  const [description, setDescription] = useState("");
  const [validations, setValidations] = useState("[]");
  const [storefront, setStorefront] = useState("NONE");
  const [pin, setPin] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [editingField, setEditingField] = useState(null);
  const [filter, setFilter] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [valueIdentity, setValueIdentity] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [resourceSearch, setResourceSearch] = useState("");
  const fields =
    fieldsFetcher.data?.ownerType === ownerType
      ? fieldsFetcher.data.fields || []
      : [];
  const types =
    fieldsFetcher.data?.ownerType === ownerType
      ? fieldsFetcher.data.types || []
      : [];
  const templates =
    standardsFetcher.data?.ownerType === ownerType
      ? standardsFetcher.data.templates || []
      : [];
  const resources =
    resourcesFetcher.data?.ownerType === ownerType
      ? resourcesFetcher.data.resources || []
      : [];
  const selectedDefinition = fields.find(
    (field) => `${field.namespace}:${field.key}` === valueIdentity,
  );
  const selectedType = types.find((item) => item.name === type);
  const ready =
    fieldsFetcher.data?.ok &&
    fieldsFetcher.data.ownerType === ownerType &&
    fieldsFetcher.state === "idle";
  const busy = actionFetcher.state !== "idle";
  const apiUrl = useCallback(
    (path, params = {}) => {
      const search = new URLSearchParams(location.search);
      for (const [key, value] of Object.entries(params)) search.set(key, value);
      return `${path}?${search}`;
    },
    [location.search],
  );
  const loadStatus = statusFetcher.load;
  const loadFields = fieldsFetcher.load;
  const loadStandards = standardsFetcher.load;
  const loadResources = resourcesFetcher.load;
  const loadResourceValue = valueFetcher.load;
  const reload = useCallback(() => {
    loadFields(apiUrl("/app/api/fields", { ownerType }));
    loadStandards(
      apiUrl("/app/api/fields", { ownerType, catalog: "standard" }),
    );
    if (VALUE_OWNERS.has(ownerType))
      loadResources(
        apiUrl("/app/api/values", { ownerType, mode: "resources" }),
      );
  }, [apiUrl, ownerType, loadFields, loadStandards, loadResources]);
  useEffect(() => {
    loadStatus(apiUrl("/app/api/status"));
  }, [apiUrl, loadStatus]);
  useEffect(() => {
    if (statusFetcher.data?.hasActivePlan) reload();
  }, [statusFetcher.data?.hasActivePlan, reload]);
  useEffect(() => {
    if (
      actionFetcher.data?.success &&
      actionFetcher.data.ownerType === ownerType
    ) {
      reload();
      setEditingField(null);
    }
  }, [actionFetcher.data, reload, ownerType]);
  const loadValue = useCallback(() => {
    if (selectedDefinition && resourceId)
      loadResourceValue(
        apiUrl("/app/api/values", {
          ownerType,
          ownerId: resourceId,
          key: selectedDefinition.key,
          namespace: selectedDefinition.namespace,
        }),
      );
  }, [selectedDefinition, resourceId, apiUrl, ownerType, loadResourceValue]);
  useEffect(() => {
    if (VALUE_OWNERS.has(ownerType)) loadValue();
  }, [ownerType, loadValue]);
  const valueReady =
    valueFetcher.state === "idle" &&
    valueFetcher.data?.ok &&
    valueFetcher.data.ownerType === ownerType &&
    valueFetcher.data.ownerId === resourceId &&
    valueFetcher.data.key === selectedDefinition?.key &&
    valueFetcher.data.namespace === selectedDefinition?.namespace;
  useEffect(() => {
    if (valueReady) setFieldValue(valueFetcher.data.value ?? "");
  }, [valueFetcher.data, valueReady]);
  useEffect(() => {
    if (valueActionFetcher.data?.success) loadValue();
  }, [valueActionFetcher.data, loadValue]);
  const submit = (input) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ ...input, ownerType }))
      form.set(key, String(value));
    actionFetcher.submit(form, {
      method: "post",
      action: apiUrl("/app/api/fields"),
    });
  };
  const saveDefinition = () =>
    submit({
      actionType: editingField ? "update" : "create",
      id: editingField?.id || "",
      name,
      namespace,
      key,
      type,
      description,
      validations,
      storefront,
      pin,
    });
  const edit = (field) => {
    setEditingField(field);
    setName(field.name);
    setNamespace(field.namespace);
    setKey(field.key);
    setType(field.type);
    setDescription(field.description || "");
    setStorefront(PUBLIC_OWNERS.has(ownerType) ? field.storefront : "NONE");
    setPin(Number.isInteger(field.pinnedPosition));
  };
  const changeOwner = (value) => {
    setOwnerType(value);
    setEditingField(null);
    setTemplateId("");
    setResourceId("");
    setValueIdentity("");
    setFieldValue("");
    setStorefront("NONE");
    setNamespace("vsn_metafields");
    setName("");
    setKey("");
    setDescription("");
    setValidations("[]");
  };
  const submitValue = (actionType) => {
    if (!selectedDefinition || !valueReady) return;
    if (
      actionType === "delete" &&
      !window.confirm(
        `Remove ${selectedDefinition.namespace}.${selectedDefinition.key} value from this resource?`,
      )
    )
      return;
    const form = new FormData();
    const input = {
      actionType,
      ownerType,
      ownerId: resourceId,
      namespace: selectedDefinition.namespace,
      key: selectedDefinition.key,
      value: fieldValue,
      confirm: `REMOVE_VALUE:${resourceId}:${selectedDefinition.namespace}:${selectedDefinition.key}`,
    };
    for (const [key, value] of Object.entries(input)) form.set(key, value);
    valueActionFetcher.submit(form, {
      method: "post",
      action: apiUrl("/app/api/values"),
    });
  };
  if (!statusFetcher.data)
    return (
      <s-page heading="VSN Metafields">
        <s-banner tone="info">Checking app status…</s-banner>
      </s-page>
    );
  if (!statusFetcher.data.ok)
    return (
      <s-page heading="VSN Metafields">
        <s-banner tone="critical">{statusFetcher.data.error}</s-banner>
      </s-page>
    );
  if (!statusFetcher.data.hasActivePlan)
    return (
      <s-page heading="VSN Metafields">
        <s-banner tone="warning">
          An active plan is required.{" "}
          <Link to={{ pathname: "/app/packages", search: location.search }}>
            Choose a plan
          </Link>
        </s-banner>
      </s-page>
    );
  return (
    <s-page heading="VSN Metafields">
      <s-section heading="Resource and capabilities">
        <s-select
          label="Metafield resource"
          value={ownerType}
          onInput={(event) => changeOwner(event.target.value)}
        >
          {OWNER_TYPES.map((owner) => (
            <s-option
              key={owner}
              value={owner}
              disabled={owner === "MEDIA_IMAGE"}
            >
              {owner.replaceAll("_", " ")}
              {owner === "MEDIA_IMAGE" ? " (deprecated)" : ""}
            </s-option>
          ))}
        </s-select>
        <s-text>
          Admin API {METAFIELD_API_VERSION}. Availability depends on your store
          and granted app permissions.
        </s-text>
        {fieldsFetcher.state !== "idle" && (
          <s-text>Checking this resource…</s-text>
        )}
        {fieldsFetcher.data?.ownerType === ownerType &&
          !fieldsFetcher.data.ok && (
            <s-banner tone="warning">
              {fieldsFetcher.data.error} Grant the relevant resource permissions
              in Shopify before retrying.
            </s-banner>
          )}
        {ready && (
          <details>
            <summary>Granted app permissions</summary>
            <p>
              {fieldsFetcher.data.scopes.join(", ") ||
                "No resource scopes granted"}
            </p>
          </details>
        )}
        {ready && (
          <s-text>
            Definition reads verified. Shopify verifies permission on each
            write. Public theme context:{" "}
            {PUBLIC_OWNERS.has(ownerType) ? "supported" : "unavailable"}.
          </s-text>
        )}
        <s-button disabled={busy} onClick={reload}>
          Refresh capabilities
        </s-button>
      </s-section>
      {actionFetcher.data?.success && (
        <s-banner tone="success">{actionFetcher.data.message}</s-banner>
      )}
      {actionFetcher.data?.error && (
        <s-banner tone="critical">{actionFetcher.data.error}</s-banner>
      )}
      <s-section
        heading={
          editingField ? "Edit definition metadata" : "Create custom definition"
        }
      >
        <s-stack gap="base">
          <s-text-field
            label="Name"
            value={name}
            onInput={(event) => setName(event.target.value)}
          />
          <s-text-field
            label="Namespace"
            disabled={Boolean(editingField)}
            value={namespace}
            onInput={(event) => setNamespace(event.target.value)}
          />
          <s-text-field
            label="Key"
            disabled={Boolean(editingField)}
            value={key}
            onInput={(event) => setKey(event.target.value)}
          />
          <s-select
            label="Type"
            disabled={Boolean(editingField)}
            value={type}
            onInput={(event) => {
              setType(event.target.value);
              setValidations("[]");
            }}
          >
            {types.map((item) => (
              <s-option key={item.name} value={item.name}>
                {item.category}: {item.name}
              </s-option>
            ))}
          </s-select>
          <s-text-field
            label="Description"
            value={description}
            onInput={(event) => setDescription(event.target.value)}
          />
          <s-select
            label="Storefront access"
            value={storefront}
            onInput={(event) => setStorefront(event.target.value)}
          >
            <s-option value="NONE">Storefront API: no access</s-option>
            {PUBLIC_OWNERS.has(ownerType) && (
              <s-option value="PUBLIC_READ">
                Storefront API: public read
              </s-option>
            )}
          </s-select>
          <s-checkbox
            label="Pin in Shopify admin"
            checked={pin}
            onChange={(event) => setPin(event.target.checked)}
          />
          {!editingField && (
            <details>
              <summary>Definition validation rules</summary>
              <p>
                Supported rules:{" "}
                {selectedType?.supportedValidations
                  ?.map((rule) => rule.name)
                  .join(", ") || "none"}
                . Use a JSON array of name/value objects; Shopify validates the
                rule values.
              </p>
              <label htmlFor="definition-validations">
                Validation rules (JSON)
              </label>
              <textarea
                id="definition-validations"
                rows={4}
                value={validations}
                onChange={(event) => setValidations(event.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </details>
          )}
          {editingField && (
            <s-text>
              Namespace, key and type stay fixed. Changing a type requires a
              separately previewed data migration.
            </s-text>
          )}
          <s-button
            variant="primary"
            disabled={!ready || busy || !name.trim() || !key.trim()}
            onClick={saveDefinition}
          >
            Save definition
          </s-button>
          {editingField && (
            <s-button
              onClick={() => {
                setEditingField(null);
                setName("");
                setKey("");
                setNamespace("vsn_metafields");
                setDescription("");
                setStorefront("NONE");
              }}
            >
              Cancel edit
            </s-button>
          )}
        </s-stack>
      </s-section>
      <s-section heading="Shopify standard definitions">
        <s-text>
          Enable official templates with their original namespace, key, type and
          validation.
        </s-text>
        {standardsFetcher.data?.ownerType === ownerType &&
          standardsFetcher.data.error && (
            <s-banner tone="warning">{standardsFetcher.data.error}</s-banner>
          )}
        <s-select
          label="Standard template"
          value={templateId}
          onInput={(event) => setTemplateId(event.target.value)}
        >
          <s-option value="">Choose a template</s-option>
          {templates
            .filter((item) => !item.enabled)
            .map((item) => (
              <s-option key={item.id} value={item.id}>
                {item.name} — {item.namespace}.{item.key}
              </s-option>
            ))}
        </s-select>
        <s-button
          disabled={
            !ready ||
            busy ||
            !templates.some((item) => item.id === templateId && !item.enabled)
          }
          onClick={() =>
            submit({ actionType: "enable-standard", templateId, storefront })
          }
        >
          Enable template
        </s-button>
      </s-section>
      <s-section heading="Registered definitions">
        <s-text-field
          label="Filter by name, namespace or key"
          value={filter}
          onInput={(event) => setFilter(event.target.value)}
        />
        <s-table>
          <s-table-header-row>
            <s-table-header>Name</s-table-header>
            <s-table-header>Namespace / key</s-table-header>
            <s-table-header>Type / access</s-table-header>
            <s-table-header>Actions</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {fields
              .filter((field) =>
                `${field.name} ${field.namespace}.${field.key}`
                  .toLowerCase()
                  .includes(filter.toLowerCase()),
              )
              .map((field) => (
                <s-table-row key={field.id}>
                  <s-table-cell>{field.name}</s-table-cell>
                  <s-table-cell>
                    {field.namespace}.{field.key}
                  </s-table-cell>
                  <s-table-cell>
                    {field.type} / {field.storefront}
                  </s-table-cell>
                  <s-table-cell>
                    <s-button
                      disabled={!ready || busy || !field.editable}
                      onClick={() => edit(field)}
                    >
                      Edit
                    </s-button>
                    <s-button
                      tone="critical"
                      disabled={!ready || busy || !field.editable}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${ownerType} definition ${field.namespace}.${field.key}? Existing values will be retained.`,
                          )
                        )
                          submit({
                            actionType: "delete",
                            id: field.id,
                            namespace: field.namespace,
                            key: field.key,
                            confirm: `DELETE_DEFINITION:${ownerType}:${field.namespace}:${field.key}`,
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
        {ready && !fields.length && (
          <s-text>No definitions for this resource.</s-text>
        )}
      </s-section>
      {VALUE_OWNERS.has(ownerType) && (
        <s-section heading="Resource values">
          <s-text>
            Text, integer, date, boolean and HTTPS URL values can be edited
            here. Additional types use Shopify’s native value editor.
          </s-text>
          <s-text-field
            label="Search resource title"
            value={resourceSearch}
            onInput={(event) => setResourceSearch(event.target.value)}
          />
          <s-button
            onClick={() =>
              resourcesFetcher.load(
                apiUrl("/app/api/values", {
                  ownerType,
                  mode: "resources",
                  search: resourceSearch,
                }),
              )
            }
          >
            Search
          </s-button>
          <s-select
            label="Resource"
            value={resourceId}
            onInput={(event) => {
              setResourceId(event.target.value);
              setFieldValue("");
            }}
          >
            <s-option value="">Choose a resource</s-option>
            {resources.map((item) => (
              <s-option key={item.id} value={item.id}>
                {item.title}
              </s-option>
            ))}
          </s-select>
          <s-select
            label="Definition"
            value={valueIdentity}
            onInput={(event) => {
              setValueIdentity(event.target.value);
              setFieldValue("");
            }}
          >
            <s-option value="">Choose a field</s-option>
            {fields
              .filter((item) =>
                [
                  "single_line_text_field",
                  "multi_line_text_field",
                  "number_integer",
                  "date",
                  "boolean",
                  "url",
                ].includes(item.type),
              )
              .map((item) => (
                <s-option key={item.id} value={`${item.namespace}:${item.key}`}>
                  {item.name} — {item.namespace}.{item.key}
                </s-option>
              ))}
          </s-select>
          {valueReady && (
            <>
              <s-text-field
                label="Value"
                value={fieldValue}
                onInput={(event) => setFieldValue(event.target.value)}
              />
              <s-button
                disabled={!fieldValue || valueActionFetcher.state !== "idle"}
                onClick={() => submitValue("set")}
              >
                Save value
              </s-button>
              <s-button
                tone="critical"
                disabled={
                  valueFetcher.data.value === null ||
                  valueActionFetcher.state !== "idle"
                }
                onClick={() => submitValue("delete")}
              >
                Remove value
              </s-button>
            </>
          )}
          {valueFetcher.data?.error && (
            <s-banner tone="critical">{valueFetcher.data.error}</s-banner>
          )}
          {valueActionFetcher.data?.error && (
            <s-banner tone="critical">{valueActionFetcher.data.error}</s-banner>
          )}
          {valueActionFetcher.data?.success && (
            <s-banner tone="success">
              {valueActionFetcher.data.message}
            </s-banner>
          )}
        </s-section>
      )}
      <s-section heading="Storefront blocks">
        <s-text>
          Add Single field or Specifications in your compatible theme’s editor.
          Set the namespace/key from the definition table. Public blocks support
          product, selected variant, collection, shop, page, article and blog
          contexts. Private customer/order resources are excluded.
        </s-text>
      </s-section>
    </s-page>
  );
}
export const headers = (args) => boundary.headers(args);
