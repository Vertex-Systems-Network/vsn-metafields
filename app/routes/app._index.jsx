import ActionButton from "../components/ActionButton";
import { useCallback, useEffect, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import TypedValueInput from "../components/TypedValueInput";
import { editableValueType } from "../value-types";
import { PageIntro, HelpLink } from "../components/Workspace";
import { LoadingState } from "../components/LoadingState";
import { APP_NAME } from "../product-config";
import SearchableSelect from "../components/SearchableSelect";
import ValidationEditor from "../components/ValidationEditor";
import FieldIcon from "../components/FieldIcon";
import {
  definitionKey,
  fieldTypeOption,
  filterDefinitions,
  resourceLabel,
  mergeTemplatePage,
} from "../field-presentation";
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
  const referencesFetcher = useFetcher();
  const location = useLocation();
  const [ownerType, setOwnerType] = useState("PRODUCT");
  const [name, setName] = useState("");
  const [namespace, setNamespace] = useState("vsn_metafields");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [type, setType] = useState("single_line_text_field");
  const [description, setDescription] = useState("");
  const [validations, setValidations] = useState("[]");
  const [storefront, setStorefront] = useState("NONE");
  const [pin, setPin] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [editingField, setEditingField] = useState(null);
  const [filter, setFilter] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterAccess, setFilterAccess] = useState("");
  const [templatePages, setTemplatePages] = useState({
    ownerType: "",
    templates: [],
  });
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
    templatePages.ownerType === ownerType ? templatePages.templates : [];
  const existingDefinitions = new Set(
    fields.map((field) => `${field.namespace}.${field.key}`),
  );
  const matchingTemplates = templates.filter(
    (item) =>
      !existingDefinitions.has(`${item.namespace}.${item.key}`) &&
      `${item.name} ${item.namespace}.${item.key}`
        .toLowerCase()
        .includes(templateSearch.trim().toLowerCase()),
  );
  const resources =
    resourcesFetcher.data?.ownerType === ownerType
      ? resourcesFetcher.data.resources || []
      : [];
  const selectedDefinition = fields.find(
    (field) => `${field.namespace}:${field.key}` === valueIdentity,
  );
  const selectedType = types.find((item) => item.name === type);
  const visibleFields = filterDefinitions(fields, {
    search: filter,
    type: filterType,
    access: filterAccess,
  });
  const typeOptions = types.map(fieldTypeOption);
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
    const page = standardsFetcher.data;
    if (!page?.ok || page.ownerType !== ownerType) return;
    setTemplatePages((previous) => mergeTemplatePage(previous, page));
  }, [standardsFetcher.data, ownerType]);
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
    if (
      valueActionFetcher.data?.success &&
      valueActionFetcher.data.ownerType === ownerType &&
      valueActionFetcher.data.ownerId === resourceId &&
      valueActionFetcher.data.namespace === selectedDefinition?.namespace &&
      valueActionFetcher.data.key === selectedDefinition?.key
    )
      loadValue();
  }, [
    valueActionFetcher.data,
    loadValue,
    ownerType,
    resourceId,
    selectedDefinition,
  ]);
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
    setKeyEdited(true);
    setType(field.type);
    setDescription(field.description || "");
    setValidations(JSON.stringify(field.validations || []));
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
    setKeyEdited(false);
    setTemplatePages({ ownerType: "", templates: [] });
    setTemplateSearch("");
    setFilter("");
    setFilterType("");
    setFilterAccess("");
    setResourceSearch("");
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
      compareDigest: valueFetcher.data.compareDigest || "",
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
      <s-page inline-size="large" heading={APP_NAME}>
        <LoadingState label="Checking app status…" skeleton />
      </s-page>
    );
  if (!statusFetcher.data.ok)
    return (
      <s-page inline-size="large" heading={APP_NAME}>
        <s-banner tone="critical">{statusFetcher.data.error}</s-banner>
      </s-page>
    );
  if (!statusFetcher.data.hasActivePlan)
    return (
      <s-page inline-size="large" heading={APP_NAME}>
        <PageIntro
          eyebrow="Your content workspace"
          title="Make your product details work harder."
          description="Define useful fields, add structured content and bring it into your storefront."
        >
          <HelpLink>Get started in a few steps</HelpLink>
        </PageIntro>
        <s-banner tone="warning">
          An active plan is required.{" "}
          <Link to={{ pathname: "/app/packages", search: location.search }}>
            Choose a plan
          </Link>
        </s-banner>
      </s-page>
    );
  return (
    <s-page inline-size="large" heading={APP_NAME}>
      <div className="vsn-hero">
        <div>
          <div className="vsn-eyebrow">Your content workspace</div>
          <h2>Better details. A clearer store.</h2>
          <p>
            Create structured fields, reuse your content and give shoppers the
            information they need to choose.
          </p>
          <div className="vsn-hero-actions">
            <a className="vsn-button" href="#definition-editor">
              Create a field <span aria-hidden="true">↗</span>
            </a>
            <HelpLink>Explore the guides</HelpLink>
          </div>
        </div>
        <div className="vsn-hero-summary">
          <strong>{statusFetcher.data.plan?.label || "Pro"} workspace</strong>
          <span>Shopify subscription verified</span>
          <dl>
            <div>
              <dt>Import rows</dt>
              <dd>{statusFetcher.data.plan?.limits?.importRows || 100}</dd>
            </div>
            <div>
              <dt>List items</dt>
              <dd>{statusFetcher.data.plan?.limits?.listItems || 128}</dd>
            </div>
            <div>
              <dt>Theme blocks</dt>
              <dd>5</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="vsn-task-grid">
        <a className="vsn-task-card" href="#definition-editor">
          <span className="vsn-step-number">01</span>
          <h3>Define your content</h3>
          <p>Add a custom field or choose a Shopify standard definition.</p>
        </a>
        <Link
          className="vsn-task-card"
          to={{ pathname: "/app/metaobjects", search: location.search }}
        >
          <span className="vsn-step-number">02</span>
          <h3>Create reusable content</h3>
          <p>Organize ingredients, FAQs and stories into metaobjects.</p>
        </Link>
        <Link
          className="vsn-task-card"
          to={{ pathname: "/app/import", search: location.search }}
        >
          <span className="vsn-step-number">03</span>
          <h3>Update with confidence</h3>
          <p>Preview every CSV row before applying changes.</p>
        </Link>
      </div>
      <nav aria-label="Fields page sections" className="vsn-section-nav">
        <a href="#definition-editor">Custom definitions</a>
        <a href="#value-editor">Values</a>
        <HelpLink topic="storefront">Show content in your theme</HelpLink>
      </nav>
      {fieldsFetcher.state !== "idle" && (
        <LoadingState
          label="Loading definitions and supported field types…"
          skeleton={!fieldsFetcher.data}
        />
      )}
      {resourcesFetcher.state !== "idle" && (
        <LoadingState label="Loading resources…" />
      )}
      {valueFetcher.state !== "idle" && (
        <LoadingState label="Loading the saved value…" />
      )}
      {referencesFetcher.state !== "idle" && (
        <LoadingState label="Finding references…" />
      )}
      <s-section heading="Resource and capabilities">
        <SearchableSelect
          label="Metafield resource"
          value={ownerType}
          onChange={changeOwner}
          options={OWNER_TYPES.map((owner) => ({
            value: owner,
            label: resourceLabel(owner),
            keywords: owner,
            disabled: owner === "MEDIA_IMAGE",
          }))}
          searchPlaceholder="Search products, collections, pages…"
          details="Choose the Shopify resource that owns your metafields."
        />
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
        <ActionButton disabled={busy} onClick={reload}>
          Refresh capabilities
        </ActionButton>
      </s-section>
      {actionFetcher.data?.success && (
        <s-banner tone="success">{actionFetcher.data.message}</s-banner>
      )}
      {actionFetcher.data?.error && (
        <s-banner tone="critical">{actionFetcher.data.error}</s-banner>
      )}
      <div id="definition-editor" className="vsn-scroll-target" />
      <s-section
        heading={
          editingField ? "Edit custom definition" : "Create custom definition"
        }
      >
        <div className="vsn-definition-layout">
          <div className="vsn-definition-form">
            <div className="vsn-form-group">
              <h3>Definition details</h3>
              <p className="vsn-field-details">
                Give the field a clear name, then choose the content it will
                hold.
              </p>
              <s-text-field
                label="Name"
                value={name}
                placeholder="e.g. Care instructions"
                onInput={(event) => {
                  setName(event.currentTarget.value);
                  if (!editingField && !keyEdited)
                    setKey(definitionKey(event.currentTarget.value));
                }}
              />
              <div className="vsn-form-row">
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
                  onInput={(event) => {
                    setKey(event.currentTarget.value);
                    setKeyEdited(true);
                  }}
                  details={
                    editingField
                      ? "Fixed after creation to preserve existing values."
                      : "Generated from the name. You can customize it before saving."
                  }
                />
              </div>
              {!editingField && keyEdited && (
                <button
                  type="button"
                  className="vsn-text-button"
                  onClick={() => {
                    setKeyEdited(false);
                    setKey(definitionKey(name));
                  }}
                >
                  Use key from name
                </button>
              )}
              <SearchableSelect
                label="Type"
                disabled={Boolean(editingField)}
                value={type}
                options={typeOptions}
                onChange={(value) => {
                  setType(value);
                  setValidations("[]");
                }}
                searchPlaceholder="Search text, number, file, metaobject…"
                details="One stores a single value. List stores multiple values."
              />
              <s-text-area
                label="Description"
                value={description}
                onInput={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="vsn-form-group">
              <h3>Access and options</h3>
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
              <ValidationEditor
                type={type}
                supported={selectedType?.supportedValidations || []}
                value={validations}
                onChange={setValidations}
                disabled={!ready || busy}
              />
              {editingField && (
                <p className="vsn-field-details">
                  Review existing values before tightening rules. Shopify checks
                  changes when you save.
                </p>
              )}
              {editingField && (
                <s-text>
                  Namespace, key and type stay fixed. Changing a type requires a
                  separately previewed data migration.
                </s-text>
              )}
            </div>
            <div className="vsn-form-actions">
              <ActionButton
                variant="primary"
                disabled={!ready || busy || !name.trim() || !key.trim()}
                loading={busy}
                onClick={saveDefinition}
              >
                Save definition
              </ActionButton>
              {editingField && (
                <ActionButton
                  onClick={() => {
                    setEditingField(null);
                    setName("");
                    setKey("");
                    setKeyEdited(false);
                    setNamespace("vsn_metafields");
                    setDescription("");
                    setValidations("[]");
                    setStorefront("NONE");
                  }}
                >
                  Cancel edit
                </ActionButton>
              )}
            </div>
          </div>
          <aside
            className="vsn-definition-preview"
            aria-label="Definition preview"
          >
            <div className="vsn-eyebrow">Definition preview</div>
            <h3>{name.trim() || "Your field name"}</h3>
            <code>
              {namespace || "namespace"}.{key || "key"}
            </code>
            <div className="vsn-preview-type">
              <FieldIcon type={fieldTypeOption({ name: type }).icon} />
              <span>{fieldTypeOption({ name: type }).label}</span>
              <span className="vsn-type-badge">
                {type.startsWith("list.") ? "List" : "One"}
              </span>
            </div>
            <dl>
              <div>
                <dt>Resource</dt>
                <dd>{resourceLabel(ownerType)}</dd>
              </div>
              <div>
                <dt>Storefront</dt>
                <dd>
                  {storefront === "PUBLIC_READ" ? "Public read" : "No access"}
                </dd>
              </div>
            </dl>
            <p>
              After saving, add values to a resource. Use the namespace and key
              to connect a theme block.
            </p>
          </aside>
        </div>
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
        <s-search-field
          label="Search standard templates"
          placeholder="Search loaded templates by name or namespace.key"
          value={templateSearch}
          onInput={(event) => {
            setTemplateSearch(event.target.value);
            setTemplateId("");
          }}
        />
        <s-text>
          {matchingTemplates.length} matches in {templates.length} loaded
          templates for this resource.
          {templatePages.ownerType !== ownerType
            ? " Catalog is not loaded yet. Refresh capabilities to retry."
            : templatePages.pageInfo?.hasNextPage
              ? " Load more to search the next catalog page."
              : " All catalog pages loaded."}
        </s-text>
        {standardsFetcher.state !== "idle" && (
          <LoadingState label="Loading a page of Shopify templates…" />
        )}
        <SearchableSelect
          label="Standard template"
          value={templateId}
          onChange={setTemplateId}
          options={matchingTemplates.map((item) => ({
            value: item.id,
            label: item.name,
            keywords: `${item.namespace}.${item.key}`,
            icon: fieldTypeOption({ name: item.type }).icon,
          }))}
          placeholder="Choose a template"
          searchPlaceholder="Search loaded templates"
        />
        <div className="vsn-action-row">
          {templatePages.ownerType === ownerType &&
            templatePages.pageInfo?.hasNextPage && (
              <ActionButton
                loading={standardsFetcher.state !== "idle"}
                onClick={() =>
                  loadStandards(
                    apiUrl("/app/api/fields", {
                      ownerType,
                      catalog: "standard",
                      after: templatePages.pageInfo.endCursor,
                    }),
                  )
                }
              >
                Load more templates
              </ActionButton>
            )}
          <ActionButton
            disabled={
              !ready ||
              busy ||
              standardsFetcher.state !== "idle" ||
              !matchingTemplates.some((item) => item.id === templateId)
            }
            onClick={() =>
              submit({
                actionType: "enable-standard",
                templateId,
                templateCursor:
                  matchingTemplates.find((item) => item.id === templateId)
                    ?.catalogCursor || "",
                storefront,
              })
            }
          >
            Enable template
          </ActionButton>
        </div>
      </s-section>
      <s-section heading="Registered definitions">
        <div className="vsn-filter-bar">
          <s-search-field
            label="Search definitions"
            placeholder="Search definitions by name, namespace or key"
            value={filter}
            onInput={(event) => setFilter(event.target.value)}
          />
          <SearchableSelect
            label="Field type"
            value={filterType}
            options={[{ value: "", label: "All types" }, ...typeOptions]}
            onChange={setFilterType}
          />
          <s-select
            label="Storefront access"
            value={filterAccess}
            onInput={(event) => setFilterAccess(event.currentTarget.value)}
          >
            <s-option value="">All access</s-option>
            <s-option value="NONE">No access</s-option>
            <s-option value="PUBLIC_READ">Public read</s-option>
          </s-select>
          {(filter || filterType || filterAccess) && (
            <ActionButton
              onClick={() => {
                setFilter("");
                setFilterType("");
                setFilterAccess("");
              }}
            >
              Clear filters
            </ActionButton>
          )}
        </div>
        <p className="vsn-filter-count" role="status">
          {visibleFields.length} of {fields.length} definitions
        </p>
        <s-table>
          <s-table-header-row>
            <s-table-header>Name</s-table-header>
            <s-table-header>Namespace / key</s-table-header>
            <s-table-header>Type / access</s-table-header>
            <s-table-header>Actions</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {visibleFields.map((field) => (
              <s-table-row key={field.id}>
                <s-table-cell>{field.name}</s-table-cell>
                <s-table-cell>
                  {field.namespace}.{field.key}
                </s-table-cell>
                <s-table-cell>
                  <div className="vsn-table-type">
                    <FieldIcon
                      type={fieldTypeOption({ name: field.type }).icon}
                    />
                    <span>{fieldTypeOption({ name: field.type }).label}</span>
                    <span className="vsn-type-badge">
                      {field.type.startsWith("list.") ? "List" : "One"}
                    </span>
                  </div>
                  <span className="vsn-field-details">
                    {field.storefront === "PUBLIC_READ"
                      ? "Public read"
                      : "No storefront access"}
                  </span>
                </s-table-cell>
                <s-table-cell>
                  <div className="vsn-action-row">
                    <ActionButton
                      disabled={!ready || busy || !field.editable}
                      onClick={() => edit(field)}
                    >
                      Edit
                    </ActionButton>
                    <ActionButton
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
                    </ActionButton>
                  </div>
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
        {ready && !fields.length && (
          <s-text>No definitions for this resource.</s-text>
        )}
        {ready && fields.length > 0 && !visibleFields.length && (
          <s-text>
            No definitions match these filters. Clear filters to see all
            definitions.
          </s-text>
        )}
      </s-section>
      {VALUE_OWNERS.has(ownerType) && (
        <s-section id="value-editor" heading="Resource values">
          <s-text>
            Choose a definition and enter a typed scalar, JSON, rich text,
            measurement, list or resource reference. Unsupported types remain in
            Shopify’s native editor.
          </s-text>
          <div className="vsn-resource-search">
            <s-search-field
              label="Search resource title"
              placeholder="Search by product or collection title"
              value={resourceSearch}
              onInput={(event) => setResourceSearch(event.target.value)}
            />
            <ActionButton
              variant="info"
              loading={resourcesFetcher.state !== "idle"}
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
            </ActionButton>
          </div>
          <SearchableSelect
            label="Resource"
            value={resourceId}
            onChange={(value) => {
              setResourceId(value);
              setFieldValue("");
            }}
            options={resources.map((item) => ({
              value: item.id,
              label: item.title,
            }))}
            placeholder="Choose a resource"
            details="Search above to retrieve matching Shopify resources; search inside this select filters the loaded results."
          />
          <SearchableSelect
            label="Definition"
            value={valueIdentity}
            onChange={(value) => {
              setValueIdentity(value);
              setFieldValue("");
            }}
            options={fields
              .filter(
                (item) =>
                  editableValueType(item.type) &&
                  !item.namespace.startsWith("app--") &&
                  item.namespace !== "shopify" &&
                  !item.namespace.startsWith("shopify--"),
              )
              .map((item) => ({
                value: `${item.namespace}:${item.key}`,
                label: item.name,
                keywords: `${item.namespace}.${item.key}`,
                icon: fieldTypeOption({ name: item.type }).icon,
                badge: item.type.startsWith("list.") ? "List" : "One",
              }))}
            placeholder="Choose a field"
            searchPlaceholder="Search by name, namespace or key"
          />
          {valueReady && (
            <>
              <TypedValueInput
                referencesLoading={referencesFetcher.state !== "idle"}
                key={`${resourceId}:${valueIdentity}`}
                type={selectedDefinition.type}
                validations={selectedDefinition.validations || []}
                value={fieldValue}
                onChange={setFieldValue}
                references={
                  referencesFetcher.data?.type ===
                  selectedDefinition.type.replace(/^list\./, "")
                    ? referencesFetcher.data.references || []
                    : []
                }
                onFindReferences={(type, search) =>
                  referencesFetcher.load(
                    apiUrl("/app/api/references", { type, search }),
                  )
                }
              />
              {referencesFetcher.data?.error && (
                <s-banner tone="critical">
                  {referencesFetcher.data.error}
                </s-banner>
              )}
              <div className="vsn-action-row">
                <ActionButton
                  disabled={!fieldValue || valueActionFetcher.state !== "idle"}
                  variant="primary"
                  loading={valueActionFetcher.state !== "idle"}
                  onClick={() => submitValue("set")}
                >
                  Save value
                </ActionButton>
                <ActionButton
                  tone="critical"
                  disabled={
                    valueFetcher.data.value === null ||
                    valueActionFetcher.state !== "idle"
                  }
                  onClick={() => submitValue("delete")}
                >
                  Remove value
                </ActionButton>
              </div>
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
