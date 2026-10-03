// Merchant-facing explanations use the labels shown in the app.
export const HELP_GLOSSARY = [
  [
    "Definition",
    "The instructions for a field: its name, identity, type and allowed values. Create it once, then use it on many resources.",
  ],
  [
    "Value",
    "The actual content saved on one resource. Care instructions is a definition; Wash at 30°C on one shirt is a value.",
  ],
  [
    "Resource",
    "The Shopify item that owns the value, such as a product, one product variant or a collection.",
  ],
  [
    "Namespace and key",
    "The field's permanent address. Namespace custom and key care_instructions together make custom.care_instructions. Your theme must use the same address.",
  ],
  [
    "Type / One / List",
    "Type controls the format, such as text, number or image reference. One holds a single value; List holds several values of the same type.",
  ],
  [
    "Metaobject definition and entry",
    "A definition describes reusable content with several fields. An entry fills those fields, for example one size guide with a title and measurements.",
  ],
  [
    "Reference",
    "A link to an existing Shopify item or metaobject. It stores the item's Shopify ID, rather than copying its content.",
  ],
  [
    "Storefront access",
    "Whether eligible content can be read by the storefront. Public access alone does not add a visible theme block.",
  ],
  [
    "Preview and conflict",
    "A preview shows proposed changes before saving. A conflict means the saved content changed after your last read, so you must reload it.",
  ],
];

export const FIRST_FIELD_STEPS = [
  "Open Fields & values in the left menu. In Metafield resource, choose Product. This means the new field will belong to products, not to individual variants.",
  "Under Create custom definition, enter Care instructions as Name, custom as Namespace and care_instructions as Key. The app suggests the key from your name; check it before saving.",
  "Choose a single-line text type with One. Add the description Short washing instructions. In Value validation, set Maximum characters to 120 if that rule is offered for this type.",
  "For a storefront example, choose Public read for Storefront access. Review the preview and select Save definition. Wait for the success message before moving on.",
  "Under Resource values, search for the shirt's title, select Search, then choose the exact Resource and the Care instructions Definition. Enter Wash at 30°C. Select Save value, then Reload to check the saved value.",
  "Open the theme editor from Shopify Admin. In an app-block-compatible section, add Single field from VSN | Metafields. Set namespace custom and key care_instructions, then label Care instructions. Preview the same shirt before saving the theme.",
];

// Rows: visible control, explanation / use, concrete example or check.
export const HELP_DETAILS = {
  fields: {
    result:
      "A saved definition appears under Registered definitions. It has no product content until you save a value separately.",
    sections: [
      {
        title: "Create custom definition: every input",
        rows: [
          [
            "Metafield resource",
            "Choose where the field belongs before creating it. Typing in this select filters the available resource types.",
            "Use Product for a shirt's care instructions; use Product variant when each size needs different content.",
          ],
          [
            "Name",
            "A readable label for staff. While the key is automatic, editing Name updates its suggestion.",
            "Care instructions",
          ],
          [
            "Namespace",
            "A grouping name shared by related fields. Use the exact namespace in your theme.",
            "custom",
          ],
          [
            "Key / Use key from name",
            "The field's unique key within its namespace. You may edit the suggestion; Use key from name restores automatic generation. Check it before saving because this editor cannot later rename the identity.",
            "care_instructions → custom.care_instructions",
          ],
          [
            "Type",
            "Open the searchable picker and choose the content format. Groups and icons help you find it; One and List distinguish a single value from several. Choose before saving: the saved type is not editable here.",
            "One single-line text for a short instruction; List for several instructions.",
          ],
          [
            "Description",
            "An explanation for people entering the content. It is not the product's saved value.",
            "Enter a short washing instruction.",
          ],
          [
            "Storefront access",
            "Choose the offered access level. Public read allows eligible storefront use; private content does not become public through a theme block.",
            "Use Public read for content intended for shoppers.",
          ],
          [
            "Pin in Shopify admin",
            "Request that Shopify pins this definition for easier access. Pinning does not save a value or publish content.",
            "Useful for frequently edited fields.",
          ],
          [
            "Definition preview",
            "Check the label, namespace/key, type and access before submitting. The preview is a summary of your form, not a saved product value.",
            "Confirm custom.care_instructions and One text.",
          ],
          [
            "Save definition / Cancel editing",
            "Save creates the new definition or updates editable metadata. Cancel editing leaves the edit flow; unsaved changes are not submitted.",
            "Wait for success, then find the row under Registered definitions.",
          ],
        ],
      },
      {
        title: "Value validation: choose rules without writing code",
        rows: [
          [
            "Minimum / Maximum characters",
            "For supported text types, restrict the length of each value. Blank means no restriction from that rule.",
            "Maximum characters 120 for short care instructions.",
          ],
          [
            "Minimum / Maximum value",
            "For supported numeric types, set the allowed range. Measurement types require JSON with a value and unit.",
            'Number: minimum 0. Weight: {"value":10,"unit":"g"}.',
          ],
          [
            "Minimum / Maximum date and time",
            "Use the date or date-time format required by the selected type. The rule is a boundary, not a default value.",
            "A date boundary can be 2026-01-01.",
          ],
          [
            "Minimum / Maximum list items",
            "Limit the number of entries in a list. The active plan's list limit also applies.",
            "Allow 1–5 care instructions.",
          ],
          [
            "Maximum decimal places",
            "Limit precision where Shopify offers this rule.",
            "2 allows prices such as 12.50.",
          ],
          [
            "Allowed choices / Allowed domains / Allowed file types",
            "Enter one item per line, following the rule offered for your selected type. Choices restrict values; domains restrict links; file types restrict referenced files.",
            "Choices: Small, Medium and Large on separate lines.",
          ],
          [
            "Pattern (regular expression)",
            "An advanced text pattern checked by Shopify. Test it with representative values before restricting an existing definition.",
            "Leave blank if you do not need a pattern.",
          ],
          [
            "Metaobject definition ID / IDs",
            "Restrict references to the intended metaobject definition. These are Shopify definition IDs, not entry handles.",
            "Use the ID of your Size guide definition.",
          ],
          [
            "Advanced validation JSON",
            "An alternative editor for an array of name/value strings. Invalid JSON disables the simple controls until repaired. Only rules supported by the current type are accepted.",
            '[{"name":"max","value":"120"}]',
          ],
          [
            "No configurable validation rules",
            "This message means Shopify provides no editable rules for the selected type. It does not mean the value can ignore its type's format.",
            "Choose an appropriate type; do not add unsupported rules.",
          ],
        ],
      },
      {
        title: "Standard templates and registered definitions",
        rows: [
          [
            "Search standard templates / Standard template",
            "Search the already loaded Shopify templates, then choose a template. Use Load more templates for additional catalog pages.",
            "An empty search result may mean the matching template is on a later page.",
          ],
          [
            "Enable standard definition",
            "Register the chosen Shopify standard template for this resource. A standard template controls its own identity and type.",
            "Read the selected template before enabling it.",
          ],
          [
            "Search definitions / Field type / Storefront access",
            "Filter registered definitions by text, type and access. Filters change the displayed rows; they do not modify saved content.",
            "Clear filters to find a definition hidden by your selection.",
          ],
          [
            "Edit / Remove",
            "Edit supported metadata and validations. Removal requires the app's eligibility checks and confirmation; removing a definition can leave its values without that definition.",
            "Review existing values before tightening rules or removing a definition.",
          ],
          [
            "Refresh",
            "Read current Shopify definitions and status again after changes made elsewhere.",
            "Use after another staff member creates a field.",
          ],
        ],
      },
    ],
    mistakes: [
      "A definition is not a value: creating Care instructions does not put text on every product.",
      "Product and Product variant are different owners. A value saved on a variant is not automatically a product value.",
      "Only the validation controls supported by the selected type appear. Tightening a rule may affect future edits of existing values.",
    ],
  },
  values: {
    result:
      "The selected resource has the saved value for the selected definition. Reload shows what Shopify actually stored.",
    sections: [
      {
        title: "Choose the item and field",
        rows: [
          [
            "Search resources / Search",
            "Enter words or Shopify search filters, then select Search to fetch resources. Plain words search the fields Shopify indexes. Use title:Shirt* for a title prefix or quote a phrase. The resource type comes from Metafield resource above.",
            "Search Cotton shirt, then choose the exact product or variant.",
          ],
          [
            "Resource",
            "Select the item to edit. Typing inside the dropdown filters the loaded results; it does not fetch every Shopify item.",
            "If it is missing, use Search resources first.",
          ],
          [
            "Definition",
            "Choose the field to write on that item. The type determines the editor and validations.",
            "Care instructions",
          ],
          [
            "Current rules",
            "Review the definition's rules before entering content. Edit the definition if a rule needs changing; the value editor cannot bypass it.",
            "Maximum 120 characters.",
          ],
        ],
      },
      {
        title: "Enter the format shown by the editor",
        rows: [
          [
            "Text / Number / Boolean / Date / Link / Color",
            "Use the displayed input for the selected type. A false Boolean and the number zero are valid values; neither means missing content.",
            "Text: Wash at 30°C. Number: 0. URL: https://example.com.",
          ],
          [
            "Lists and structured values",
            "Where the editor requests JSON, enter valid JSON in the type's required shape. A list is an array; measurements include value and unit. Do not paste prose into a JSON input.",
            '["Wash cold","Dry flat"] for a text list; {"value":10,"unit":"g"} for weight.',
          ],
          [
            "References / Find references",
            "Choose an existing eligible item from the reference picker, or use the existing Shopify ID when the editor requests it. Search results depend on type and permissions.",
            "A product reference needs a product ID, not a product title or URL.",
          ],
          [
            "Save value",
            "Submit the content for this selected resource and definition. Read the success or error message before submitting again.",
            "Saving one shirt does not update every shirt.",
          ],
          [
            "Reload",
            "Fetch the saved content again. This may replace an unsaved draft, so copy important unsaved text first.",
            "Use after a conflict to review another editor's change.",
          ],
          [
            "Remove value",
            "Remove only this selected saved value after confirmation. The definition and other products' values remain.",
            "Double-check both Resource and Definition first.",
          ],
        ],
      },
    ],
    mistakes: [
      "The value editor currently writes Product, Product variant and Collection values. A resource visible in definition reads is not necessarily supported for writing values.",
      "A conflict protects a newer saved value. Reload and decide which content to keep; repeated Save clicks cannot force an old value over it.",
      "A reference can be unavailable because of missing page/file permissions, the wrong reference type or a deleted item.",
    ],
  },
  metaobjects: {
    result:
      "A reusable definition contains named fields. Each saved entry fills them; use a reference field to connect an entry to a product.",
    sections: [
      {
        title: "Create or choose the reusable content structure",
        rows: [
          [
            "Definition",
            "Select New definition to create a structure, or select an existing one to inspect it. Definitions owned by another app may be read only.",
            "Size guide",
          ],
          [
            "Name / Merchant-owned type / Description",
            "Name is the readable label; type is the stable identity; description tells editors what belongs here. Existing identities are not editable here.",
            "Name Size guide, type size_guide, description Measurements for one product family.",
          ],
          [
            "Storefront access",
            "Choose private access or, on Pro, eligible public access. Public access alone does not publish every entry or add a theme block.",
            "Keep internal content private.",
          ],
          [
            "Field key / Field label / Field type",
            "For each new field, choose a stable key, readable label and content format. Existing field types and keys are read only here.",
            "Key title, label Title, One text.",
          ],
          [
            "Required / Value validation",
            "Required fields must be filled when saving an entry. Supported validations constrain the values; use the same rule guidance as custom definitions.",
            "Make Title required; add a maximum text length if offered.",
          ],
          [
            "Add field / Remove field",
            "Adjust the unsaved field list for a new definition. The active plan limits fields per new definition.",
            "Starter 2, Growth 5, Pro 25 fields.",
          ],
          [
            "Create definition / Save definition",
            "Save the new structure or editable metadata of an existing structure. Check the success message before creating entries.",
            "After creation, choose that definition in the selector.",
          ],
        ],
      },
      {
        title: "Create, edit and remove entries",
        rows: [
          [
            "Handle",
            "A unique readable identity for an entry within its type. Choose a clear stable handle.",
            "cotton-shirt-size-guide",
          ],
          [
            "Entry fields",
            "Fill the inputs defined above. Required and validated fields must pass before saving.",
            "Title Cotton shirt sizes; add the measurements in the requested format.",
          ],
          [
            "Publish status / Publish this entry as public content",
            "Draft is for unfinished/private content. Saving an Active public entry requires Pro and explicit publication confirmation. Review the content first.",
            "Public access plus Active status makes an eligible entry available to storefront consumers.",
          ],
          [
            "Save entry / Cancel editing",
            "Save this entry, or leave edit mode without submitting the draft. Reopen the entry to verify the saved content.",
            "Start with Draft while preparing content.",
          ],
          [
            "Entries / Edit / Delete / Load more / Refresh",
            "Browse entries page by page, edit a selected entry or confirm its deletion. Refresh reads current entries again.",
            "Deleting an entry may leave referencing fields empty.",
          ],
          [
            "Check and remove empty definition",
            "Remove only an eligible empty merchant-owned definition after the checks and confirmation. Other apps' definitions cannot be removed here.",
            "Remove selected entries first if the definition is no longer needed.",
          ],
        ],
      },
    ],
    mistakes: [
      "A definition and an entry are separate saves. Creating the structure alone does not create content.",
      "Draft entries do not become public merely because the definition allows public access.",
      "Coordinate simultaneous entry edits: the app detects earlier edits from its last read, but Shopify does not provide an atomic compare-digest operation for metaobject updates.",
    ],
  },
  imports: {
    result:
      "A saved preview records before/proposed values. Only confirmed valid rows are applied, with results tracked in the saved job.",
    sections: [
      {
        title: "Prepare the CSV without losing data",
        rows: [
          [
            "Download template",
            "Start with the supplied file and keep its header unchanged. Replace the example Shopify ID and field address with real values.",
            "Header: ownerType,ownerId,namespace,key,type,value_json",
          ],
          [
            "ownerType / ownerId",
            "Choose a supported owner and its existing Shopify global ID. A title is not an ID.",
            "PRODUCT and gid://shopify/Product/123456789 (replace with your actual ID).",
          ],
          [
            "namespace / key / type",
            "Match the intended field's exact address and type. Do not rename these columns.",
            "custom, care_instructions, single_line_text_field",
          ],
          [
            "value_json",
            "The CSV cell contains a JSON-encoded string. CSV quoting and JSON quoting are separate. Use the downloaded/exported file as your formatting reference.",
            'The parsed cell for text is "Wash at 30°C" including JSON quotes. A text list is itself a JSON array encoded as a string.',
          ],
          [
            "Upload CSV / CSV content",
            "Upload or paste content under 256 KB. Stay within the active plan's rows per job: Starter 5, Growth 20, Pro 100.",
            "Try one row first, then inspect the preview.",
          ],
        ],
      },
      {
        title: "Review, apply and recover",
        rows: [
          [
            "Validate and preview",
            "Create a saved preview without applying the proposed writes. Read invalid rows, before values and proposed values.",
            "Fix a wrong ID or format in a fresh CSV before applying.",
          ],
          [
            "Import job / Refresh",
            "Choose a saved job to read its status and row results. Refresh retrieves the latest saved state.",
            "Reopen the same job after an interrupted apply.",
          ],
          [
            "Export before / Export proposed",
            "Download snapshots for review. The before export includes existing values; it cannot represent deletion of values newly created by this job.",
            "Keep the before file before applying changes.",
          ],
          [
            "Apply only valid rows from preview / Apply / Continue",
            "Confirm the displayed preview identity, then apply or continue bounded chunks. Invalid rows are skipped. A changed saved value is a conflict and is not overwritten.",
            "Review each chunk's result before continuing.",
          ],
          [
            "Prepare failed-row retry",
            "On Pro, prepare eligible failed rows for another attempt. Retry still checks the original snapshot; it does not override changed content.",
            "For a conflict, create a fresh preview after reading current content.",
          ],
          [
            "Remove saved job",
            "Remove the log and snapshots after confirmation. This does not undo Shopify writes. Saved logs expire after seven days.",
            "Restore existing values with a fresh preview of the before export; remove newly created values individually if needed.",
          ],
        ],
      },
    ],
    mistakes: [
      "Do not rename ownerType to owner_type or ownerId to owner_id: the exact template header is required.",
      "A timeout does not prove a write failed. Reopen and refresh the saved job before applying again.",
      "Exporting or deleting a log is not an automatic rollback.",
    ],
  },
  storefront: {
    result:
      "The theme preview displays eligible saved content on the chosen resource. Saving app data and saving the theme are separate actions.",
    sections: [
      {
        title: "Connect the block to the correct content",
        rows: [
          [
            "Online Store → Themes → theme editor",
            "Choose the theme and template you intend to edit. Find a section that accepts app blocks, then Add block → Apps → VSN | Metafields.",
            "Use the product template for your care instructions example.",
          ],
          [
            "Single field",
            "Show one supported metafield, with optional label and formatting.",
            "custom.care_instructions",
          ],
          [
            "Specifications",
            "Show up to five mapped fields as rows, a table or cards.",
            "Map material and dimensions, then provide readable labels.",
          ],
          [
            "Reference cards",
            "Show eligible reference content using the entry's title, summary, image and link keys.",
            "Keys must match the referenced metaobject fields.",
          ],
          [
            "FAQ",
            "Show eligible FAQ references as questions and answers. Set the exact question/answer keys.",
            "Use question and answer fields in each FAQ entry.",
          ],
          [
            "Media",
            "Show supported image/video references. Video controls and looping are optional; unsupported files may not render.",
            "Choose a supported image or video value, not a document intended for download.",
          ],
          [
            "Preview / Save theme",
            "Check desktop and mobile, an item with content, an item without content and each relevant variant. Save the theme when the result is correct.",
            "If empty, verify access, type, resource, namespace/key and saved value before changing styling.",
          ],
        ],
      },
    ],
    mistakes: [
      "An empty block is usually a content/address/context/access issue. Spacing or colors cannot make a missing value appear.",
      "The theme blocks exclude customer and order content. Available public contexts depend on the block and theme.",
      "For metaobject content, check public access, Active status and matching reference field mappings.",
    ],
  },
  plans: {
    result:
      "After Shopify approval, refreshed subscription status shows the active plan and its actual limits.",
    sections: [
      {
        title: "Choose capacity and understand approval",
        rows: [
          [
            "Plan cards",
            "Compare rows per import, items per list and fields per new metaobject definition. These limits do not cap your number of products.",
            "Use Pro for public metaobject publishing, failed-import retry preparation and the largest limits.",
          ],
          [
            "Start trial / Switch to plan",
            "Begin Shopify's approval flow. A new subscription offers a five-day trial; switching an active subscription does not restart it.",
            "Read Shopify's price and terms before approving.",
          ],
          [
            "Continue to Shopify plan approval",
            "Use this visible link if automatic navigation does not complete. Open the app from Shopify Admin for its embedded approval flow.",
            "Return to the app after approval.",
          ],
          [
            "Refresh subscription status / Current plan",
            "Read Shopify's authoritative billing status. A clicked button alone is not proof of an active subscription.",
            "Staging shows test billing; it is not a real charge.",
          ],
          [
            "Downgrade",
            "Existing content remains. New writes must satisfy the smaller plan; Active public entry saves and failed-row retry preparation require Pro.",
            "Review larger lists and your publishing workflow before switching.",
          ],
        ],
      },
    ],
    mistakes: [
      "A plan selected in the browser is not an entitlement until Shopify confirms active billing.",
      "Trial length and billing interval are separate: prices are USD every 30 days.",
      "A smaller plan does not delete products, existing saved values or existing public entries.",
    ],
  },
  recovery: {
    result:
      "Connection status shows which tools are ready and which permission is missing. Support receives the visible status and action, without tokens.",
    sections: [
      {
        title: "Read Connection and permissions",
        rows: [
          [
            "API / Environment / Database",
            "API is the Shopify API version in use; Environment identifies staging/live configuration; Database shows whether the app's database can be reached.",
            "Staging means you are testing the staging app.",
          ],
          [
            "Active plan / Saved import jobs",
            "Active plan reports the verified subscription state. Saved import jobs counts current saved logs, not successful rows or total imports ever performed.",
            "Zero saved jobs can be a normal empty state.",
          ],
          [
            "Product & collection values / Metaobjects",
            "Ready means the app has the checked prerequisites for that tool. A write must still pass type, validation and plan checks.",
            "Open the related editor to inspect a specific operation.",
          ],
          [
            "Pages & articles / Enable page references",
            "Page and article references need optional read_content permission. The store owner can approve Shopify's permission request.",
            "Approve, then wait for refreshed verified readiness.",
          ],
          [
            "Files & media / Enable file references",
            "File and media reference searches need optional read_files permission. Declining leaves other tools available.",
            "Ask the store owner if your staff account cannot approve.",
          ],
          [
            "Refresh status",
            "Check the actual connection again after permissions, billing or availability change.",
            "If a granted permission still looks missing, refresh before retrying.",
          ],
          [
            "Copy support diagnostics / Technical connection details",
            "Copy the sanitized status and include the page, selected resource, action and visible error. If copying fails, share the visible technical details manually.",
            "Do not share session URLs, login tokens or store credentials.",
          ],
        ],
      },
      {
        title: "Resolve common errors",
        rows: [
          [
            "Invalid format / validation failed",
            "Check the selected type and Current rules. Repair JSON, IDs, required fields or limits, then submit the corrected value.",
            "Do not remove a useful validation merely to accept malformed content.",
          ],
          [
            "Changed value / conflict",
            "Read current content with Reload or a fresh preview and review the newer value before making another change.",
            "Coordinate with the other editor.",
          ],
          [
            "Timeout / HTTP error / too many subrequests",
            "Read the saved value or job status before retrying a write. If it persists, copy diagnostics with the page and action. Catalog pages and imports use bounded requests.",
            "Never assume a timeout means nothing was saved.",
          ],
          [
            "Empty dropdown / no results",
            "Clear loaded-option filters, search the resource title or use Load more templates/entries where offered. Check reference permissions.",
            "A picker searches its available options; it does not necessarily load the full store.",
          ],
        ],
      },
    ],
    mistakes: [
      "Ready status is not proof that every individual write or theme display has succeeded.",
      "Do not repeatedly submit a mutation while its result is unknown.",
      "Approve permissions through Shopify's visible modal; pasting an old session URL cannot grant them.",
    ],
  },
};
