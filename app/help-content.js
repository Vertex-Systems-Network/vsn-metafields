export const HELP_TOPICS = [
  {
    id: "fields",
    title: "Create your first field",
    description:
      "Definitions describe what a field is. Values hold the actual content.",
    link: "/app",
    action: "Open fields & values",
    steps: [
      "Choose a resource, such as Product, Variant or Collection.",
      "Choose a Shopify standard definition, or enter a custom field name, namespace, key and type.",
      "Save the definition. Its type and key cannot be changed here after creation.",
    ],
    faqs: [
      [
        "What are namespace and key?",
        "They identify the field, for example custom.care. Copy the same namespace and key into your theme block. Use a merchant-owned namespace; app-reserved definitions may be read only.",
      ],
      [
        "Why is a resource unavailable?",
        "Shopify availability depends on the resource and permissions granted to the app. Open connection diagnostics below, then ask the store owner to grant the configured permissions.",
      ],
    ],
  },
  {
    id: "values",
    title: "Add and edit values",
    description:
      "Add the right information to the right product, variant or collection.",
    link: "/app#value-editor",
    action: "Open the value editor",
    steps: [
      "Select a definition and an existing resource in Resource values.",
      "Enter the value in the displayed format. Lists and structured types use JSON; references use an existing resource ID.",
      "Save, then reload to verify. If someone changed the value, reload before trying again.",
    ],
    faqs: [
      [
        "Can I edit every Shopify owner?",
        "Definition reads cover the owners Shopify makes available. This app's value editor currently writes Product, Product variant and Collection values; other owners are not certified for value editing.",
      ],
      [
        "Why is a save blocked?",
        "Check the value's format, the definition's validations, your plan's list limit and current permissions. A conflict means the value changed after it was loaded; saving an old snapshot is blocked.",
      ],
    ],
  },
  {
    id: "metaobjects",
    title: "Build reusable metaobjects",
    description:
      "A definition describes a reusable content collection; each entry is an item in it.",
    link: "/app/metaobjects",
    action: "Open metaobjects",
    steps: [
      "Create a definition, such as Size guide, with a merchant-owned type and fields: Title, Size and Fit notes.",
      "Add an entry with a unique handle and save it as Draft.",
      "For public content, review its fields, enable Public API access and explicitly confirm publishing an Active entry.",
    ],
    faqs: [
      [
        "Why can't I remove a definition?",
        "Only empty merchant-owned definitions can be removed. Remove selected entries first. Entry deletion may leave reference fields empty. Another app's definitions are read only.",
      ],
      [
        "Does public access automatically show the entry?",
        "Public access and Active status make content eligible. Add a compatible theme block or reference field and test the relevant theme context to display it.",
      ],
    ],
  },
  {
    id: "imports",
    title: "Preview and apply CSV imports",
    description: "Check every change before it reaches Shopify.",
    link: "/app/import",
    action: "Open import & export",
    steps: [
      "Download the template and replace the sample product ID, namespace, key, type and value. Keep the header unchanged; value_json contains a JSON-encoded string.",
      "Upload or paste a CSV under 256 KB within your plan's row limit. Preview before/after values and invalid rows.",
      "Confirm the exact preview, then apply. Reopen the saved job to continue bounded chunks. Export a snapshot before making further changes.",
    ],
    faqs: [
      [
        "What happens to invalid or changed rows?",
        "Invalid rows are skipped. Changed rows are conflicts and require a fresh preview. Failed rows can be prepared for retry; retries still check the original snapshot.",
      ],
      [
        "Does removing a job undo its changes?",
        "No. It removes the saved log and snapshots. Existing-value snapshots can be restored through a fresh preview; newly created values need selected manual removal. Logs expire after seven days.",
      ],
    ],
  },
  {
    id: "storefront",
    title: "Show content in your theme",
    description:
      "Five customizable blocks help you present useful information.",
    link: "/app",
    action: "Review your field settings",
    steps: [
      "In Shopify, open Online Store → Themes → Customize, then choose a template with an app-block-compatible section.",
      "Add Single field, Specifications, Reference cards, FAQ or Media from VSN | Metafields. Match your namespace/key and any reference field mapping.",
      "Choose layout, labels, spacing and empty behavior. Preview desktop/mobile, another resource and each selected product variant before publishing the theme.",
    ],
    faqs: [
      [
        "Why is the block empty?",
        "Check resource context, namespace/key, saved value, reference mapping and supported type. Metaobjects may need public access and Active status. Missing or unsupported values can be intentionally hidden.",
      ],
      [
        "Can blocks show customer or order data?",
        "These theme blocks exclude customer and order content. Eligible public product, variant and collection contexts depend on the block and theme.",
      ],
    ],
  },
  {
    id: "plans",
    title: "Plans and billing",
    description: "Choose capacity without limiting your number of products.",
    link: "/app/packages",
    action: "Compare plans",
    steps: [
      "Starter: $19 USD/30 days, 10 import rows, 16 list items and 3 fields per new metaobject definition. Growth: $35, 50 rows, 64 items and 10 fields. Pro: $55, 100 rows, 128 items and 25 fields.",
      "Start a 5-day trial for a new subscription. Shopify displays the billing details for your approval; switching an active plan does not start a new trial.",
      "Return to the app and refresh subscription status. Existing Pro subscriptions keep pro-plan, $55 USD/30 days and their original trial terms.",
    ],
    faqs: [
      [
        "Does a smaller plan delete content?",
        "No. Existing Shopify content and saved exports remain. New writes and imports must fit the smaller plan. Metadata edits and selected removals remain available while the subscription is active.",
      ],
      [
        "The plan button only refreshes. What should I do?",
        "Open the app from Shopify Admin. Use the visible Continue to Shopify plan approval link if automatic navigation fails, then refresh status after approval. Staging uses test billing. If it still fails, copy the connection diagnostics below.",
      ],
    ],
  },
  {
    id: "recovery",
    title: "Troubleshooting and recovery",
    description: "Understand errors and share the right evidence with support.",
    link: "/app/guide#connection",
    action: "Open connection diagnostics",
    steps: [
      "Refresh the affected page and inspect its visible error. A changed value needs a fresh read; it cannot be forced over another editor's change.",
      "Check connection diagnostics for permissions, database availability and active-plan state. Request only permissions configured for this app.",
      "Copy support diagnostics and include the page, action and visible error. Diagnostics exclude tokens and session content.",
    ],
    faqs: [
      [
        "What does a timeout mean?",
        "It does not prove that a write failed. Reload Shopify data or the saved import job before retrying a mutation. Avoid submitting the same change repeatedly.",
      ],
      [
        "Can two people edit the same metaobject?",
        "A last-read timestamp detects earlier edits, but Shopify metaobject updates have no atomic compare-digest operation. Coordinate simultaneous edits; metafield values use Shopify's atomic stale-write protection.",
      ],
    ],
  },
];
