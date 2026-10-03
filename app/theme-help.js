// Settings and defaults are checked against the shipped theme block schemas.
export const THEME_HELP = [
  {
    id: "vsn-faq",
    title: "FAQ",
    settings: [
      {
        id: "source",
        label: "Resource",
        description:
          "Choose the Shopify resource supplying content. Current page uses the context of the template you preview; Selected product variant follows the selected variant where supported.",
        details:
          "Default: auto. Choices: Current page, Product, Selected product variant, Collection, Shop, Page, Article, Blog",
      },
      {
        id: "source_product",
        label: "Product override",
        description:
          "Choose a specific product when you want to override the product supplied by the current template. Leave unset for normal page context.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "source_collection",
        label: "Collection override",
        description:
          "Choose a specific collection when overriding the current collection context. Verify the preview uses the intended collection.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "namespace",
        label: "Default namespace",
        description:
          "Use the namespace of your saved definition. Together with the key, this identifies the saved metafield.",
        details: "Default: vsn_metafields",
      },
      {
        id: "field_key",
        label: "Metafield key",
        description:
          "Use the exact key of the metafield on the selected resource. The value must be saved and readable by the storefront.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "alignment",
        label: "Text alignment",
        description: "Align the text inside the block: left, center or right.",
        details: "Default: left. Choices: Left, Center, Right",
      },
      {
        id: "width",
        label: "Maximum width",
        description:
          "Limit the block's maximum width in pixels. The available theme section can still be narrower.",
        details: "Default: 1200. Range: 300–1200 px; step 50",
      },
      {
        id: "padding",
        label: "Desktop padding",
        description:
          "Space inside the block on desktop, in pixels. It does not create content.",
        details: "Default: 16. Range: 0–48 px; step 2",
      },
      {
        id: "mobile_padding",
        label: "Mobile padding",
        description:
          "Space inside the block on mobile, in pixels. Check a narrow preview.",
        details: "Default: 12. Range: 0–32 px; step 2",
      },
      {
        id: "margin_top",
        label: "Top space",
        description: "Space above the block in pixels, outside its border.",
        details: "Default: 0. Range: 0–64 px; step 2",
      },
      {
        id: "margin_bottom",
        label: "Bottom space",
        description: "Space below the block in pixels, outside its border.",
        details: "Default: 0. Range: 0–64 px; step 2",
      },
      {
        id: "gap",
        label: "Gap",
        description: "Space between elements inside the block, in pixels.",
        details: "Default: 8. Range: 0–32 px; step 2",
      },
      {
        id: "font_size",
        label: "Value size",
        description: "Value text size on desktop, in pixels.",
        details: "Default: 16. Range: 12–32 px; step 1",
      },
      {
        id: "mobile_size",
        label: "Mobile value size",
        description: "Value text size on mobile, in pixels.",
        details: "Default: 16. Range: 12–28 px; step 1",
      },
      {
        id: "background",
        label: "Background",
        description:
          "Block background color. Check contrast against both value and label colors.",
        details: "Default: #ffffff",
      },
      {
        id: "text_color",
        label: "Value color",
        description:
          "Set the saved value's text color. Keep it readable against the background.",
        details: "Default: #222222",
      },
      {
        id: "border_color",
        label: "Border color",
        description:
          "Border color. It is visible when border width is greater than zero.",
        details: "Default: #dddddd",
      },
      {
        id: "border_width",
        label: "Border width",
        description:
          "Border thickness in pixels. Zero removes the visible border.",
        details: "Default: 1. Range: 0–4 px; step 1",
      },
      {
        id: "radius",
        label: "Corner radius",
        description: "Corner rounding in pixels. Zero makes square corners.",
        details: "Default: 0. Range: 0–32 px; step 2",
      },
      {
        id: "visibility",
        label: "Device visibility",
        description:
          "Choose all devices, desktop only or mobile only. Hidden device modes may explain an empty preview.",
        details:
          "Default: all. Choices: All devices, Desktop only, Mobile only",
      },
      {
        id: "question_key",
        label: "Metaobject question field",
        description:
          "The exact field key containing the FAQ question in each referenced entry.",
        details: "Default: question",
      },
      {
        id: "answer_key",
        label: "Metaobject answer field",
        description:
          "The exact field key containing the FAQ answer in each referenced entry.",
        details: "Default: answer",
      },
      {
        id: "open_first",
        label: "Open first answer",
        description:
          "Expand the first FAQ answer initially. Other answers remain available to open.",
        details: "Default: false",
      },
    ],
  },
  {
    id: "vsn-media",
    title: "Media",
    settings: [
      {
        id: "source",
        label: "Resource",
        description:
          "Choose the Shopify resource supplying content. Current page uses the context of the template you preview; Selected product variant follows the selected variant where supported.",
        details:
          "Default: auto. Choices: Current page, Product, Selected product variant, Collection, Shop, Page, Article, Blog",
      },
      {
        id: "source_product",
        label: "Product override",
        description:
          "Choose a specific product when you want to override the product supplied by the current template. Leave unset for normal page context.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "source_collection",
        label: "Collection override",
        description:
          "Choose a specific collection when overriding the current collection context. Verify the preview uses the intended collection.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "namespace",
        label: "Default namespace",
        description:
          "Use the namespace of your saved definition. Together with the key, this identifies the saved metafield.",
        details: "Default: vsn_metafields",
      },
      {
        id: "field_key",
        label: "Metafield key",
        description:
          "Use the exact key of the metafield on the selected resource. The value must be saved and readable by the storefront.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "alignment",
        label: "Text alignment",
        description: "Align the text inside the block: left, center or right.",
        details: "Default: left. Choices: Left, Center, Right",
      },
      {
        id: "width",
        label: "Maximum width",
        description:
          "Limit the block's maximum width in pixels. The available theme section can still be narrower.",
        details: "Default: 1200. Range: 300–1200 px; step 50",
      },
      {
        id: "padding",
        label: "Desktop padding",
        description:
          "Space inside the block on desktop, in pixels. It does not create content.",
        details: "Default: 16. Range: 0–48 px; step 2",
      },
      {
        id: "mobile_padding",
        label: "Mobile padding",
        description:
          "Space inside the block on mobile, in pixels. Check a narrow preview.",
        details: "Default: 12. Range: 0–32 px; step 2",
      },
      {
        id: "margin_top",
        label: "Top space",
        description: "Space above the block in pixels, outside its border.",
        details: "Default: 0. Range: 0–64 px; step 2",
      },
      {
        id: "margin_bottom",
        label: "Bottom space",
        description: "Space below the block in pixels, outside its border.",
        details: "Default: 0. Range: 0–64 px; step 2",
      },
      {
        id: "gap",
        label: "Gap",
        description: "Space between elements inside the block, in pixels.",
        details: "Default: 8. Range: 0–32 px; step 2",
      },
      {
        id: "font_size",
        label: "Value size",
        description: "Value text size on desktop, in pixels.",
        details: "Default: 16. Range: 12–32 px; step 1",
      },
      {
        id: "mobile_size",
        label: "Mobile value size",
        description: "Value text size on mobile, in pixels.",
        details: "Default: 16. Range: 12–28 px; step 1",
      },
      {
        id: "background",
        label: "Background",
        description:
          "Block background color. Check contrast against both value and label colors.",
        details: "Default: #ffffff",
      },
      {
        id: "text_color",
        label: "Value color",
        description:
          "Set the saved value's text color. Keep it readable against the background.",
        details: "Default: #222222",
      },
      {
        id: "border_color",
        label: "Border color",
        description:
          "Border color. It is visible when border width is greater than zero.",
        details: "Default: #dddddd",
      },
      {
        id: "border_width",
        label: "Border width",
        description:
          "Border thickness in pixels. Zero removes the visible border.",
        details: "Default: 1. Range: 0–4 px; step 1",
      },
      {
        id: "radius",
        label: "Corner radius",
        description: "Corner rounding in pixels. Zero makes square corners.",
        details: "Default: 0. Range: 0–32 px; step 2",
      },
      {
        id: "visibility",
        label: "Device visibility",
        description:
          "Choose all devices, desktop only or mobile only. Hidden device modes may explain an empty preview.",
        details:
          "Default: all. Choices: All devices, Desktop only, Mobile only",
      },
      {
        id: "controls",
        label: "Video controls",
        description:
          "Show video playback controls for supported video content.",
        details: "Default: true",
      },
      {
        id: "loop",
        label: "Loop video",
        description:
          "Repeat supported video playback. Browser playback rules still apply.",
        details: "Default: false",
      },
    ],
  },
  {
    id: "vsn-reference-cards",
    title: "Reference cards",
    settings: [
      {
        id: "source",
        label: "Resource",
        description:
          "Choose the Shopify resource supplying content. Current page uses the context of the template you preview; Selected product variant follows the selected variant where supported.",
        details:
          "Default: auto. Choices: Current page, Product, Selected product variant, Collection, Shop, Page, Article, Blog",
      },
      {
        id: "source_product",
        label: "Product override",
        description:
          "Choose a specific product when you want to override the product supplied by the current template. Leave unset for normal page context.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "source_collection",
        label: "Collection override",
        description:
          "Choose a specific collection when overriding the current collection context. Verify the preview uses the intended collection.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "namespace",
        label: "Default namespace",
        description:
          "Use the namespace of your saved definition. Together with the key, this identifies the saved metafield.",
        details: "Default: vsn_metafields",
      },
      {
        id: "field_key",
        label: "Metafield key",
        description:
          "Use the exact key of the metafield on the selected resource. The value must be saved and readable by the storefront.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "alignment",
        label: "Text alignment",
        description: "Align the text inside the block: left, center or right.",
        details: "Default: left. Choices: Left, Center, Right",
      },
      {
        id: "width",
        label: "Maximum width",
        description:
          "Limit the block's maximum width in pixels. The available theme section can still be narrower.",
        details: "Default: 1200. Range: 300–1200 px; step 50",
      },
      {
        id: "padding",
        label: "Desktop padding",
        description:
          "Space inside the block on desktop, in pixels. It does not create content.",
        details: "Default: 16. Range: 0–48 px; step 2",
      },
      {
        id: "mobile_padding",
        label: "Mobile padding",
        description:
          "Space inside the block on mobile, in pixels. Check a narrow preview.",
        details: "Default: 12. Range: 0–32 px; step 2",
      },
      {
        id: "margin_top",
        label: "Top space",
        description: "Space above the block in pixels, outside its border.",
        details: "Default: 0. Range: 0–64 px; step 2",
      },
      {
        id: "margin_bottom",
        label: "Bottom space",
        description: "Space below the block in pixels, outside its border.",
        details: "Default: 0. Range: 0–64 px; step 2",
      },
      {
        id: "gap",
        label: "Gap",
        description: "Space between elements inside the block, in pixels.",
        details: "Default: 8. Range: 0–32 px; step 2",
      },
      {
        id: "font_size",
        label: "Value size",
        description: "Value text size on desktop, in pixels.",
        details: "Default: 16. Range: 12–32 px; step 1",
      },
      {
        id: "mobile_size",
        label: "Mobile value size",
        description: "Value text size on mobile, in pixels.",
        details: "Default: 16. Range: 12–28 px; step 1",
      },
      {
        id: "background",
        label: "Background",
        description:
          "Block background color. Check contrast against both value and label colors.",
        details: "Default: #ffffff",
      },
      {
        id: "text_color",
        label: "Value color",
        description:
          "Set the saved value's text color. Keep it readable against the background.",
        details: "Default: #222222",
      },
      {
        id: "border_color",
        label: "Border color",
        description:
          "Border color. It is visible when border width is greater than zero.",
        details: "Default: #dddddd",
      },
      {
        id: "border_width",
        label: "Border width",
        description:
          "Border thickness in pixels. Zero removes the visible border.",
        details: "Default: 1. Range: 0–4 px; step 1",
      },
      {
        id: "radius",
        label: "Corner radius",
        description: "Corner rounding in pixels. Zero makes square corners.",
        details: "Default: 0. Range: 0–32 px; step 2",
      },
      {
        id: "visibility",
        label: "Device visibility",
        description:
          "Choose all devices, desktop only or mobile only. Hidden device modes may explain an empty preview.",
        details:
          "Default: all. Choices: All devices, Desktop only, Mobile only",
      },
      {
        id: "title_key",
        label: "Metaobject title field",
        description:
          "The exact field key used for the title of each referenced entry.",
        details: "Default: title",
      },
      {
        id: "summary_key",
        label: "Metaobject summary field",
        description:
          "The exact field key used for the description of each referenced entry.",
        details: "Default: description",
      },
      {
        id: "image_key",
        label: "Metaobject image field",
        description:
          "The exact field key used for the image of each referenced entry.",
        details: "Default: image",
      },
      {
        id: "link_key",
        label: "Metaobject link field",
        description:
          "The exact field key used for the link of each referenced entry.",
        details: "Default: link",
      },
      {
        id: "columns",
        label: "Desktop columns",
        description:
          "Control the number of columns in the supported card layout. Check how the block fits on mobile.",
        details: "Default: 3. Range: 1–3 ; step 1",
      },
    ],
  },
  {
    id: "vsn-single-field",
    title: "Single field",
    settings: [
      {
        id: "source",
        label: "Resource",
        description:
          "Choose the Shopify resource supplying content. Current page uses the context of the template you preview; Selected product variant follows the selected variant where supported.",
        details:
          "Default: auto. Choices: Current page, Product, Selected product variant, Collection, Shop, Page, Article, Blog",
      },
      {
        id: "source_product",
        label: "Product override",
        description:
          "Choose a specific product when you want to override the product supplied by the current template. Leave unset for normal page context.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "source_collection",
        label: "Collection override",
        description:
          "Choose a specific collection when overriding the current collection context. Verify the preview uses the intended collection.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "namespace",
        label: "Default namespace",
        description:
          "Use the namespace of your saved definition. Together with the key, this identifies the saved metafield.",
        details: "Default: vsn_metafields",
      },
      {
        id: "field_key",
        label: "Metafield key",
        description:
          "Use the exact key of the metafield on the selected resource. The value must be saved and readable by the storefront.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "show_label",
        label: "Show label",
        description:
          "Show or hide the label above the value. This does not change the saved definition.",
        details: "Default: true",
      },
      {
        id: "label",
        label: "Label",
        description:
          "The label shown in the block, separate from the saved value.",
        details: "Default: Details",
      },
      {
        id: "alignment",
        label: "Text alignment",
        description: "Align the text inside the block: left, center or right.",
        details: "Default: left. Choices: Left, Center, Right",
      },
      {
        id: "width",
        label: "Maximum width",
        description:
          "Limit the block's maximum width in pixels. The available theme section can still be narrower.",
        details: "Default: 1200. Range: 300–1200 px; step 50",
      },
      {
        id: "padding",
        label: "Desktop padding",
        description:
          "Space inside the block on desktop, in pixels. It does not create content.",
        details: "Default: 16. Range: 0–48 px; step 2",
      },
      {
        id: "mobile_padding",
        label: "Mobile padding",
        description:
          "Space inside the block on mobile, in pixels. Check a narrow preview.",
        details: "Default: 12. Range: 0–32 px; step 2",
      },
      {
        id: "margin_top",
        label: "Top space",
        description: "Space above the block in pixels, outside its border.",
        details: "Default: 0. Range: 0–64 px; step 2",
      },
      {
        id: "margin_bottom",
        label: "Bottom space",
        description: "Space below the block in pixels, outside its border.",
        details: "Default: 0. Range: 0–64 px; step 2",
      },
      {
        id: "gap",
        label: "Gap",
        description: "Space between elements inside the block, in pixels.",
        details: "Default: 8. Range: 0–32 px; step 2",
      },
      {
        id: "font_size",
        label: "Value size",
        description: "Value text size on desktop, in pixels.",
        details: "Default: 16. Range: 12–32 px; step 1",
      },
      {
        id: "mobile_size",
        label: "Mobile value size",
        description: "Value text size on mobile, in pixels.",
        details: "Default: 16. Range: 12–28 px; step 1",
      },
      {
        id: "label_size",
        label: "Label size",
        description:
          "Set the label text size in pixels. Check long labels at narrow widths.",
        details: "Default: 16. Range: 12–32 px; step 1",
      },
      {
        id: "label_weight",
        label: "Label weight",
        description: "Set how bold label text appears.",
        details: "Default: 600. Choices: Normal, Semibold, Bold",
      },
      {
        id: "background",
        label: "Background",
        description:
          "Block background color. Check contrast against both value and label colors.",
        details: "Default: #ffffff",
      },
      {
        id: "text_color",
        label: "Value color",
        description:
          "Set the saved value's text color. Keep it readable against the background.",
        details: "Default: #222222",
      },
      {
        id: "label_color",
        label: "Label color",
        description:
          "Set the label text color. Keep it readable against the background.",
        details: "Default: #222222",
      },
      {
        id: "border_color",
        label: "Border color",
        description:
          "Border color. It is visible when border width is greater than zero.",
        details: "Default: #dddddd",
      },
      {
        id: "border_width",
        label: "Border width",
        description:
          "Border thickness in pixels. Zero removes the visible border.",
        details: "Default: 1. Range: 0–4 px; step 1",
      },
      {
        id: "radius",
        label: "Corner radius",
        description: "Corner rounding in pixels. Zero makes square corners.",
        details: "Default: 0. Range: 0–32 px; step 2",
      },
      {
        id: "true_text",
        label: "True label",
        description: "The text shown for a saved Boolean true value.",
        details: "Default: Yes",
      },
      {
        id: "false_text",
        label: "False label",
        description: "The text shown for a saved Boolean false value.",
        details: "Default: No",
      },
      {
        id: "date_format",
        label: "Date format",
        description: "Choose how supported saved dates appear to shoppers.",
        details:
          "Default: %b %d, %Y. Choices: Oct 2, 2026, 2026-10-02, 02/10/2026",
      },
      {
        id: "link_text",
        label: "Link label",
        description:
          "The visible label used for supported links. Make the destination clear to shoppers.",
        details: "Default: Learn more",
      },
      {
        id: "new_tab",
        label: "Open links in new tab",
        description:
          "Open supported links in a new browser tab instead of the current tab.",
        details: "Default: false",
      },
      {
        id: "list_style",
        label: "List layout",
        description:
          "Show list values as bullets, inline items or stacked plain text. This does not change the saved list.",
        details: "Default: bullets. Choices: Bullets, Inline, Stacked",
      },
      {
        id: "image_width",
        label: "Media width",
        description:
          "Maximum displayed image width in pixels, subject to available space.",
        details: "Default: 400. Range: 100–800 px; step 50",
      },
      {
        id: "fallback",
        label: "Text when no value is available",
        description:
          "Text to show when eligible content is unavailable. It does not create a missing value.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "visibility",
        label: "Device visibility",
        description:
          "Choose all devices, desktop only or mobile only. Hidden device modes may explain an empty preview.",
        details:
          "Default: all. Choices: All devices, Desktop only, Mobile only",
      },
    ],
  },
  {
    id: "vsn-specifications",
    title: "Specifications",
    settings: [
      {
        id: "source",
        label: "Resource",
        description:
          "Choose the Shopify resource supplying content. Current page uses the context of the template you preview; Selected product variant follows the selected variant where supported.",
        details:
          "Default: auto. Choices: Current page, Product, Selected product variant, Collection, Shop, Page, Article, Blog",
      },
      {
        id: "source_product",
        label: "Product override",
        description:
          "Choose a specific product when you want to override the product supplied by the current template. Leave unset for normal page context.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "source_collection",
        label: "Collection override",
        description:
          "Choose a specific collection when overriding the current collection context. Verify the preview uses the intended collection.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "namespace",
        label: "Default namespace",
        description:
          "Use the namespace of your saved definition. Together with the key, this identifies the saved metafield.",
        details: "Default: vsn_metafields",
      },
      {
        id: "heading",
        label: "Heading",
        description:
          "The heading shown above this block. Change it to a label shoppers understand.",
        details: "Default: Specifications",
      },
      {
        id: "key_1",
        label: "Field 1 key or namespace.key",
        description:
          "Map this specification to a field key, or namespace.key to override Default namespace. Use an exact saved field address.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "label_1",
        label: "Field 1 label",
        description:
          "The shopper-facing label for the specification in the matching numbered field row.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "key_2",
        label: "Field 2 key or namespace.key",
        description:
          "Map this specification to a field key, or namespace.key to override Default namespace. Use an exact saved field address.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "label_2",
        label: "Field 2 label",
        description:
          "The shopper-facing label for the specification in the matching numbered field row.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "key_3",
        label: "Field 3 key or namespace.key",
        description:
          "Map this specification to a field key, or namespace.key to override Default namespace. Use an exact saved field address.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "label_3",
        label: "Field 3 label",
        description:
          "The shopper-facing label for the specification in the matching numbered field row.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "key_4",
        label: "Field 4 key or namespace.key",
        description:
          "Map this specification to a field key, or namespace.key to override Default namespace. Use an exact saved field address.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "label_4",
        label: "Field 4 label",
        description:
          "The shopper-facing label for the specification in the matching numbered field row.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "key_5",
        label: "Field 5 key or namespace.key",
        description:
          "Map this specification to a field key, or namespace.key to override Default namespace. Use an exact saved field address.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "label_5",
        label: "Field 5 label",
        description:
          "The shopper-facing label for the specification in the matching numbered field row.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "hide_empty",
        label: "Hide empty rows",
        description:
          "Hide specifications with no saved value. Turn off to show the chosen empty-value text instead.",
        details: "Default: true",
      },
      {
        id: "empty_text",
        label: "Empty row text",
        description:
          "The placeholder shown for an empty specification when empty rows are allowed.",
        details: "Default: —",
      },
      {
        id: "layout",
        label: "Layout",
        description:
          "Choose the visual arrangement for specifications: rows, table or cards.",
        details: "Default: rows. Choices: Rows, Table style, Cards",
      },
      {
        id: "columns",
        label: "Card columns",
        description:
          "Control the number of columns in the supported card layout. Check how the block fits on mobile.",
        details: "Default: 1. Choices: One, Two, Three",
      },
      {
        id: "alignment",
        label: "Text alignment",
        description: "Align the text inside the block: left, center or right.",
        details: "Default: left. Choices: Left, Center, Right",
      },
      {
        id: "width",
        label: "Maximum width",
        description:
          "Limit the block's maximum width in pixels. The available theme section can still be narrower.",
        details: "Default: 1200. Range: 300–1200 px; step 50",
      },
      {
        id: "padding",
        label: "Desktop padding",
        description:
          "Space inside the block on desktop, in pixels. It does not create content.",
        details: "Default: 16. Range: 0–48 px; step 2",
      },
      {
        id: "mobile_padding",
        label: "Mobile padding",
        description:
          "Space inside the block on mobile, in pixels. Check a narrow preview.",
        details: "Default: 12. Range: 0–32 px; step 2",
      },
      {
        id: "margin_top",
        label: "Top space",
        description: "Space above the block in pixels, outside its border.",
        details: "Default: 0. Range: 0–64 px; step 2",
      },
      {
        id: "margin_bottom",
        label: "Bottom space",
        description: "Space below the block in pixels, outside its border.",
        details: "Default: 0. Range: 0–64 px; step 2",
      },
      {
        id: "gap",
        label: "Gap",
        description: "Space between elements inside the block, in pixels.",
        details: "Default: 8. Range: 0–32 px; step 2",
      },
      {
        id: "font_size",
        label: "Value size",
        description: "Value text size on desktop, in pixels.",
        details: "Default: 16. Range: 12–32 px; step 1",
      },
      {
        id: "mobile_size",
        label: "Mobile value size",
        description: "Value text size on mobile, in pixels.",
        details: "Default: 16. Range: 12–28 px; step 1",
      },
      {
        id: "label_size",
        label: "Label size",
        description:
          "Set the label text size in pixels. Check long labels at narrow widths.",
        details: "Default: 16. Range: 12–32 px; step 1",
      },
      {
        id: "label_weight",
        label: "Label weight",
        description: "Set how bold label text appears.",
        details: "Default: 600. Choices: Normal, Semibold, Bold",
      },
      {
        id: "background",
        label: "Background",
        description:
          "Block background color. Check contrast against both value and label colors.",
        details: "Default: #ffffff",
      },
      {
        id: "text_color",
        label: "Value color",
        description:
          "Set the saved value's text color. Keep it readable against the background.",
        details: "Default: #222222",
      },
      {
        id: "label_color",
        label: "Label color",
        description:
          "Set the label text color. Keep it readable against the background.",
        details: "Default: #222222",
      },
      {
        id: "border_color",
        label: "Border color",
        description:
          "Border color. It is visible when border width is greater than zero.",
        details: "Default: #dddddd",
      },
      {
        id: "border_width",
        label: "Border width",
        description:
          "Border thickness in pixels. Zero removes the visible border.",
        details: "Default: 1. Range: 0–4 px; step 1",
      },
      {
        id: "radius",
        label: "Corner radius",
        description: "Corner rounding in pixels. Zero makes square corners.",
        details: "Default: 0. Range: 0–32 px; step 2",
      },
      {
        id: "true_text",
        label: "True label",
        description: "The text shown for a saved Boolean true value.",
        details: "Default: Yes",
      },
      {
        id: "false_text",
        label: "False label",
        description: "The text shown for a saved Boolean false value.",
        details: "Default: No",
      },
      {
        id: "date_format",
        label: "Date format",
        description: "Choose how supported saved dates appear to shoppers.",
        details:
          "Default: %b %d, %Y. Choices: Oct 2, 2026, 2026-10-02, 02/10/2026",
      },
      {
        id: "link_text",
        label: "Link label",
        description:
          "The visible label used for supported links. Make the destination clear to shoppers.",
        details: "Default: Learn more",
      },
      {
        id: "new_tab",
        label: "Open links in new tab",
        description:
          "Open supported links in a new browser tab instead of the current tab.",
        details: "Default: false",
      },
      {
        id: "list_style",
        label: "List layout",
        description:
          "Show list values as bullets, inline items or stacked plain text. This does not change the saved list.",
        details: "Default: bullets. Choices: Bullets, Inline, Stacked",
      },
      {
        id: "image_width",
        label: "Media width",
        description:
          "Maximum displayed image width in pixels, subject to available space.",
        details: "Default: 400. Range: 100–800 px; step 50",
      },
      {
        id: "fallback",
        label: "Text when no value is available",
        description:
          "Text to show when eligible content is unavailable. It does not create a missing value.",
        details: "Optional; choose only if needed.",
      },
      {
        id: "visibility",
        label: "Device visibility",
        description:
          "Choose all devices, desktop only or mobile only. Hidden device modes may explain an empty preview.",
        details:
          "Default: all. Choices: All devices, Desktop only, Mobile only",
      },
    ],
  },
];
