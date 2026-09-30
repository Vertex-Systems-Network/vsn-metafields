import { useEffect, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session.shop };
};

export default function Index() {
  const statusFetcher = useFetcher();
  const fieldsFetcher = useFetcher();
  const standardsFetcher = useFetcher();
  const resourcesFetcher = useFetcher();
  const valueFetcher = useFetcher();
  const valueActionFetcher = useFetcher();
  const actionFetcher = useFetcher();
  const location = useLocation();

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState("single_line_text_field");
  const [ownerType, setOwnerType] = useState("PRODUCT");
  const [templateId, setTemplateId] = useState("");
  const [editingField, setEditingField] = useState(null);
  const [editedName, setEditedName] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [valueKey, setValueKey] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [resourceSearch, setResourceSearch] = useState("");

  // Load status on mount
  useEffect(() => {
    statusFetcher.load(`/app/api/status${window.location.search}`);
  }, []);

  // Load fields once we know there's an active plan
  useEffect(() => {
    if (statusFetcher.data?.hasActivePlan) {
      fieldsFetcher.load(`/app/api/fields${window.location.search}${window.location.search ? "&" : "?"}ownerType=${ownerType}`);
      standardsFetcher.load(`/app/api/fields${window.location.search}${window.location.search ? "&" : "?"}ownerType=${ownerType}&catalog=standard`);
      resourcesFetcher.load(`/app/api/values${window.location.search}${window.location.search ? "&" : "?"}ownerType=${ownerType}&mode=resources`);
    }
  }, [statusFetcher.data?.hasActivePlan, ownerType]);

  // Reload fields after successful action
  useEffect(() => {
    if (actionFetcher.data?.success) {
      fieldsFetcher.load(`/app/api/fields${window.location.search}${window.location.search ? "&" : "?"}ownerType=${ownerType}`);
      standardsFetcher.load(`/app/api/fields${window.location.search}${window.location.search ? "&" : "?"}ownerType=${ownerType}&catalog=standard`);
      setName("");
      setKey("");
      setType("single_line_text_field");
      setEditingField(null);
    }
  }, [actionFetcher.data]);

  useEffect(() => {
    if (statusFetcher.data?.hasActivePlan && resourceId && valueKey) {
      const params = new URLSearchParams(window.location.search);
      params.set("ownerType", ownerType);
      params.set("ownerId", resourceId);
      params.set("key", valueKey);
      valueFetcher.load(`/app/api/values?${params}`);
    }
  }, [statusFetcher.data?.hasActivePlan, ownerType, resourceId, valueKey]);

  useEffect(() => {
    if (valueFetcher.data?.ok && valueFetcher.data.ownerId === resourceId && valueFetcher.data.key === valueKey) {
      setFieldValue(valueFetcher.data.value ?? "");
    }
  }, [valueFetcher.data, resourceId, valueKey]);

  useEffect(() => {
    if (valueActionFetcher.data?.success && resourceId && valueKey) {
      const params = new URLSearchParams(window.location.search);
      params.set("ownerType", ownerType);
      params.set("ownerId", resourceId);
      params.set("key", valueKey);
      valueFetcher.load(`/app/api/values?${params}`);
    }
  }, [valueActionFetcher.data]);

  const typeOptions = [
    { label: "Text (Single Line)", value: "single_line_text_field" },
    { label: "Text (Multi Line)", value: "multi_line_text_field" },
    { label: "Number", value: "number_integer" },
    { label: "Date", value: "date" },
    { label: "Boolean", value: "boolean" },
    { label: "URL", value: "url" },
  ];

  const handleCreate = () => {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("key", key);
    formData.set("type", type);
    formData.set("ownerType", ownerType);
    actionFetcher.submit(formData, {
      method: "post",
      action: `/app/api/fields${window.location.search}`,
    });
  };

  const handleReset = () => {
    if (
      !window.confirm(
        `Reset all VSN ${ownerType} metafield definitions? Existing metafield values will not be deleted, but these definitions will be removed.`
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("actionType", "reset");
    formData.set("ownerType", ownerType);
    formData.set("confirm", `RESET_VSN_METAFIELDS:${ownerType}`);

    actionFetcher.submit(formData, {
      method: "post",
      action: `/app/api/fields${window.location.search}`,
    });
  };

  const handleDelete = (field) => {
    if (!window.confirm(`Remove only ${ownerType} definition ${field.key}? Existing values will be retained.`)) return;
    const formData = new FormData();
    formData.set("actionType", "delete");
    formData.set("ownerType", ownerType);
    formData.set("id", field.id);
    formData.set("key", field.key);
    formData.set("confirm", `DELETE_VSN_METAFIELD:${field.key}`);
    actionFetcher.submit(formData, { method: "post", action: `/app/api/fields${window.location.search}` });
  };

  const handleEnableStandard = () => {
    if (!templateId) return;
    const formData = new FormData();
    formData.set("actionType", "enable-standard");
    formData.set("ownerType", ownerType);
    formData.set("templateId", templateId);
    actionFetcher.submit(formData, { method: "post", action: `/app/api/fields${window.location.search}` });
  };

  const handleUpdate = () => {
    if (!editingField || !editedName.trim()) return;
    const formData = new FormData();
    formData.set("actionType", "update");
    formData.set("ownerType", ownerType);
    formData.set("id", editingField.id);
    formData.set("key", editingField.key);
    formData.set("name", editedName.trim());
    actionFetcher.submit(formData, { method: "post", action: `/app/api/fields${window.location.search}` });
  };

  const searchResources = () => {
    const params = new URLSearchParams(window.location.search);
    params.set("ownerType", ownerType);
    params.set("mode", "resources");
    params.set("search", resourceSearch);
    resourcesFetcher.load(`/app/api/values?${params}`);
  };

  const submitValue = (actionType) => {
    if (!resourceId || !valueKey) return;
    if (actionType === "delete" && !window.confirm(`Remove ${valueKey} value from this ${ownerType}?`)) return;
    const form = new FormData();
    form.set("actionType", actionType);
    form.set("ownerType", ownerType);
    form.set("ownerId", resourceId);
    form.set("key", valueKey);
    if (actionType === "set") form.set("value", fieldValue);
    if (actionType === "delete") form.set("confirm", `REMOVE_VALUE:${resourceId}:${valueKey}`);
    valueActionFetcher.submit(form, { method: "post", action: `/app/api/values${window.location.search}` });
  };

  const isActionLoading = actionFetcher.state !== "idle";

  // ✅ Fixed loading states
  const isFetchingStatus = statusFetcher.state === "loading" || !statusFetcher.data;
  const isLoadingFields = statusFetcher.data?.hasActivePlan && fieldsFetcher.state === "loading";

  const status = statusFetcher.data;
  const fieldsData = fieldsFetcher.data;
  const actionResult = actionFetcher.data;

  // ✅ Show loader until status is fetched
  if (isFetchingStatus) {
    return (
      <s-page heading="VSN Metafields">
        <s-banner tone="info">Checking app status...</s-banner>
      </s-page>
    );
  }

  if (!status.ok) {
    return (
      <s-page heading="VSN Metafields">
        <s-banner tone="critical">
          {status.error || "Status check failed."}
        </s-banner>
      </s-page>
    );
  }

  if (!status.hasActivePlan) {
    return (
      <s-page heading="VSN Metafields">
        <s-banner tone="warning">
          No active plan found.{" "}
          <Link to={{ pathname: "/app/packages", search: location.search }}>
            Click here to choose a plan
          </Link>{" "}
          and get started.
        </s-banner>
      </s-page>
    );
  }

  const fields = fieldsData?.ownerType === ownerType ? fieldsData.fields : [];
  const templates = standardsFetcher.data?.ownerType === ownerType ? standardsFetcher.data.templates || [] : [];
  const availableTemplates = templates.filter((item) => !item.enabled);
  const selectedTemplateId = availableTemplates.some((item) => item.id === templateId) ? templateId : "";
  const resources = resourcesFetcher.data?.ownerType === ownerType ? resourcesFetcher.data.resources || [] : [];
  const selectedDefinition = fields.find((field) => field.key === valueKey);
  const valueReady = valueFetcher.data?.ok && valueFetcher.data.ownerType === ownerType &&
    valueFetcher.data.ownerId === resourceId && valueFetcher.data.key === valueKey;

  return (
    <s-page heading="VSN Metafields">
      {actionResult?.success && (
        <s-banner tone="success">{actionResult.message}</s-banner>
      )}
      {actionResult?.error && (
        <s-banner tone="critical">{actionResult.error}</s-banner>
      )}
      {fieldsData && !fieldsData.ok && (
        <s-banner tone="critical">
          {fieldsData.error || "Failed to load fields."}
        </s-banner>
      )}
      {isLoadingFields && (
        <s-banner tone="info">Loading registered fields...</s-banner>
      )}
      {standardsFetcher.data && !standardsFetcher.data.ok && (
        <s-banner tone="critical">{standardsFetcher.data.error || "Failed to load standard definitions."}</s-banner>
      )}
      {resourcesFetcher.data && !resourcesFetcher.data.ok && <s-banner tone="critical">{resourcesFetcher.data.error}</s-banner>}

      <s-section heading="Create Custom Definition">
        <s-stack direction="inline" gap="base">
          <s-select
            label="Resource"
            value={ownerType}
            onInput={(event) => { setOwnerType(event.target.value); setTemplateId(""); setEditingField(null); setResourceId(""); setValueKey(""); setFieldValue(""); }}
          >
            <s-option value="PRODUCT">Product</s-option>
            <s-option value="PRODUCTVARIANT">Product variant</s-option>
            <s-option value="COLLECTION">Collection</s-option>
          </s-select>
          <s-text-field
            label="Field Name"
            name="name"
            placeholder="e.g. Inspired By"
            autoComplete="off"
            value={name}
            onInput={(event) => setName(event.target.value)}
          />
          <s-text-field
            label="Field Key"
            name="key"
            placeholder="e.g. inspired_by"
            autoComplete="off"
            value={key}
            onInput={(event) => setKey(event.target.value)}
          />
          <s-select
            label="Field Type"
            value={type}
            onInput={(event) => setType(event.target.value)}
          >
            {typeOptions.map((option) => (
              <s-option key={option.value} value={option.value}>
                {option.label}
              </s-option>
            ))}
          </s-select>
          <s-button
            variant="primary"
            loading={isActionLoading}
            onClick={handleCreate}
          >
            Create Field
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Set Resource Value">
        <s-text>Select a resource and one of your custom definitions. Shopify standard definitions can be enabled below; their value editor will follow the staging capability probe.</s-text>
        <s-stack direction="inline" gap="base">
          <s-text-field label="Find resource by title" value={resourceSearch} onInput={(event) => setResourceSearch(event.target.value)} />
          <s-button onClick={searchResources}>Search</s-button>
          <s-select label="Resource" value={resourceId} onInput={(event) => { setResourceId(event.target.value); setFieldValue(""); }}>
            <s-option value="">Select a resource</s-option>
            {resources.map((resource) => <s-option key={resource.id} value={resource.id}>{resource.title}</s-option>)}
          </s-select>
          <s-select label="Definition" value={valueKey} onInput={(event) => { setValueKey(event.target.value); setFieldValue(""); }}>
            <s-option value="">Select a definition</s-option>
            {fields.map((field) => <s-option key={field.id} value={field.key}>{field.name}</s-option>)}
          </s-select>
        </s-stack>
        {resourcesFetcher.state === "loading" && <s-text>Loading resources...</s-text>}
        {valueFetcher.data && !valueFetcher.data.ok && <s-banner tone="critical">{valueFetcher.data.error}</s-banner>}
        {valueReady && selectedDefinition && (
          <s-stack direction="inline" gap="base">
            {selectedDefinition.type === "boolean" ? (
              <s-select label="Value" value={fieldValue} onInput={(event) => setFieldValue(event.target.value)}>
                <s-option value="">Choose a value</s-option>
                <s-option value="true">True</s-option>
                <s-option value="false">False</s-option>
              </s-select>
            ) : (
              <s-text-field label={`${selectedDefinition.name} value (${selectedDefinition.type})`} value={fieldValue} onInput={(event) => setFieldValue(event.target.value)} />
            )}
            <s-button variant="primary" disabled={!fieldValue || valueActionFetcher.state !== "idle"} onClick={() => submitValue("set")}>Save value</s-button>
            <s-button tone="critical" disabled={valueFetcher.data.value === null || valueActionFetcher.state !== "idle"} onClick={() => submitValue("delete")}>Remove value</s-button>
          </s-stack>
        )}
        {valueActionFetcher.data?.error && <s-banner tone="critical">{valueActionFetcher.data.error}</s-banner>}
        {valueActionFetcher.data?.success && <s-banner tone="success">{valueActionFetcher.data.message}</s-banner>}
      </s-section>

      <s-section heading="Enable Shopify Standard Definition">
        <s-text>Official Shopify templates keep their reserved namespace and type. Available templates depend on the selected resource.</s-text>
        <s-stack direction="inline" gap="base">
          <s-select label="Standard definition" value={selectedTemplateId} onInput={(event) => setTemplateId(event.target.value)}>
            <s-option value="">Select a template</s-option>
            {availableTemplates.map((item) => (
              <s-option key={item.id} value={item.id}>{item.name} ({item.namespace}.{item.key})</s-option>
            ))}
          </s-select>
          <s-button disabled={!selectedTemplateId || isActionLoading} onClick={handleEnableStandard}>Enable standard</s-button>
        </s-stack>
        {standardsFetcher.state === "loading" && <s-text>Loading templates...</s-text>}
        {standardsFetcher.data?.ok && availableTemplates.length === 0 && <s-text>All available templates are already enabled, or none apply to this resource.</s-text>}
      </s-section>

      <s-section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <s-heading>Registered Fields</s-heading>
          <s-button tone="critical" loading={isActionLoading} onClick={handleReset}>
            Reset {ownerType} Fields
          </s-button>
        </div>

        <s-section padding="none">
          <s-table padding="10">
            <s-table-header-row>
              <s-table-header>Name</s-table-header>
              <s-table-header>Key</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {fields.map((field) => (
                <s-table-row key={`${ownerType}:${field.key}`}>
                  <s-table-cell>{field.name}</s-table-cell>
                  <s-table-cell>{field.key}</s-table-cell>
                  <s-table-cell>{field.type}</s-table-cell>
                  <s-table-cell>
                    <s-button disabled={isActionLoading} onClick={() => { setEditingField(field); setEditedName(field.name); }}>
                      Edit name
                    </s-button>
                    <s-button tone="critical" disabled={isActionLoading} onClick={() => handleDelete(field)}>
                      Remove
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
        {editingField && (
          <s-section heading={`Edit ${editingField.key}`}>
            <s-text-field label="Definition name" value={editedName} onInput={(event) => setEditedName(event.target.value)} />
            <s-button disabled={!editedName.trim() || isActionLoading} onClick={handleUpdate}>Save name</s-button>
            <s-button disabled={isActionLoading} onClick={() => setEditingField(null)}>Cancel</s-button>
          </s-section>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
