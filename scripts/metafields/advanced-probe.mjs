import assert from "node:assert/strict";
import {
  createDefinition,
  getDefinitions,
  updateDefinition,
} from "../../app/definitions.server.js";
import { removeDefinition } from "../../app/definition-removal.server.js";
import {
  validateValueInput,
  mutateValue,
  readResourceValue,
  verifyReferences,
} from "../../app/metafield-values.server.js";
import {
  createMetaobjectDefinition,
  listMetaobjectDefinitions,
  listMetaobjectEntries,
  saveMetaobjectEntry,
  readMetaobjectEntry,
  updateMetaobjectDefinition,
  removeMetaobjectEntry,
  removeEmptyMetaobjectDefinition,
} from "../../app/metaobjects.server.js";
import {
  previewImport,
  runImportChunk,
  readJob,
} from "../../app/bulk-values.server.js";
import { exportValueCsv } from "../../app/bulk-csv.js";
import { featureDiagnostics } from "../../app/diagnostics.server.js";
import { encodeValue } from "../../app/value-types.js";
import { hasActivePlan } from "../../app/active-plan.server.js";

export async function verifyAdvancedBatch(
  admin,
  db,
  shop,
  product,
  variantId,
  collection,
  nonce,
  types,
) {
  const fields = [],
    values = [];
  let metaDefinition, metaEntry, originalError;
  const jobIds = [];
  const report = {
    typedValues: [],
    staleDigestRejected: false,
    referenceVerification: false,
    metaobjects: false,
    bulk: false,
    diagnostics: false,
    cleanup: false,
  };
  const must = (result) => {
    if (!result.ok)
      throw new Error(result.error || "Unconfirmed advanced mutation");
    return result;
  };
  const prepare = async (type, suffix, validations = []) => {
    const created = must(
      await createDefinition(
        admin,
        "PRODUCT",
        {
          name: `Disposable ${type}`,
          namespace: "vsn_probe",
          key: `advanced_${nonce}_${suffix}`,
          type,
          storefront: "NONE",
          validations: JSON.stringify(validations),
        },
        types,
      ),
    ).definition;
    fields.push(created);
    return (await getDefinitions(admin, "PRODUCT")).find(
      (f) => f.id === created.id,
    );
  };
  try {
    const cases = [
      ["single_line_text_field", "Example"],
      ["multi_line_text_field", "Line one\nLine two"],
      ["number_integer", "0"],
      ["number_decimal", "1.25"],
      ["boolean", "false"],
      ["date", "2026-10-02"],
      ["date_time", "2026-10-02T09:00:00Z"],
      ["url", "https://example.com/vsn-probe"],
      ["color", "#112233"],
      ["json", '{"safe":true,"count":0}'],
      [
        "rich_text_field",
        '{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","value":"Disposable text"}]}]}',
      ],
      ["dimension", '{"value":10,"unit":"centimeters"}'],
      ["weight", '{"value":1,"unit":"kilograms"}'],
      ["volume", '{"value":1,"unit":"liters"}'],
      ["list.single_line_text_field", '["first","second"]'],
      ["list.number_integer", "[0,2]"],
      ["product_reference", product.id],
      ["variant_reference", variantId],
      ["collection_reference", collection.id],
      ["list.product_reference", JSON.stringify([product.id])],
    ];
    let primary;
    for (let i = 0; i < cases.length; i++) {
      const [type, raw] = cases[i];
      if (!types.some((t) => t.name === type))
        throw new Error(`Pinned type catalog omitted ${type}`);
      const definition = await prepare(type, String(i));
      const value = validateValueInput("PRODUCT", product.id, definition, raw);
      await verifyReferences(admin, type, value);
      values.push({ ownerId: product.id, definition });
      const saved = must(
        await mutateValue(admin, {
          action: "set",
          ownerId: product.id,
          definition,
          value,
          compareDigest: null,
        }),
      );
      const read = await readResourceValue(
        admin,
        "PRODUCT",
        product.id,
        definition.namespace,
        definition.key,
      );
      assert.equal(read.type, type);
      const normalized = (v) => {
        try {
          return JSON.parse(encodeValue(type, v));
        } catch {
          return v;
        }
      };
      assert.deepEqual(
        normalized(read.value),
        normalized(value),
        `${type} round trip`,
      );
      report.typedValues.push(type);
      if (i === 0)
        primary = { definition, digest: saved.metafield.compareDigest };
    }
    must(
      await mutateValue(admin, {
        action: "set",
        ownerId: product.id,
        definition: primary.definition,
        value: "Changed by probe",
        compareDigest: primary.digest,
      }),
    );
    const stale = await mutateValue(admin, {
      action: "set",
      ownerId: product.id,
      definition: primary.definition,
      value: "Stale overwrite",
      compareDigest: primary.digest,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, "INVALID_COMPARE_DIGEST");
    report.staleDigestRejected = true;
    await assert.rejects(
      verifyReferences(admin, "product_reference", collection.id),
    );
    report.referenceVerification = true;

    const type = `vsn_probe_${nonce}`;
    metaDefinition = await createMetaobjectDefinition(
      admin,
      {
        type,
        name: "Disposable advanced FAQ",
        fields: [
          {
            key: "question",
            name: "Question",
            type: "single_line_text_field",
            required: true,
          },
          {
            key: "answer",
            name: "Answer",
            type: "multi_line_text_field",
            required: false,
          },
        ],
        storefront: "NONE",
      },
      types.map((t) => t.name),
    );
    let selected = (await listMetaobjectDefinitions(admin)).find(
      (d) => d.id === metaDefinition.id,
    );
    metaEntry = await saveMetaobjectEntry(admin, selected, {
      handle: `probe-${nonce.replaceAll("_", "-")}`,
      values: { question: "Question", answer: "Answer" },
      status: "DRAFT",
    });
    assert.ok(
      (await listMetaobjectEntries(admin, type)).nodes.some(
        (e) => e.id === metaEntry.id,
      ),
    );
    let current = await readMetaobjectEntry(admin, metaEntry.id, type);
    await saveMetaobjectEntry(admin, selected, {
      id: metaEntry.id,
      updatedAt: current.updatedAt,
      handle: current.handle,
      values: { question: "Updated question" },
      status: "DRAFT",
    });
    current = await readMetaobjectEntry(admin, metaEntry.id, type);
    assert.equal(
      current.fields.find((f) => f.key === "answer").value,
      "Answer",
    );
    await updateMetaobjectDefinition(admin, selected, {
      name: "Renamed disposable FAQ",
      storefront: "NONE",
    });
    const metaField = await prepare("metaobject_reference", "meta", [
      { name: "metaobject_definition_id", value: metaDefinition.id },
    ]);
    await verifyReferences(admin, metaField.type, metaEntry.id);
    values.push({ ownerId: product.id, definition: metaField });
    must(
      await mutateValue(admin, {
        action: "set",
        ownerId: product.id,
        definition: metaField,
        value: metaEntry.id,
        compareDigest: null,
      }),
    );
    report.typedValues.push("metaobject_reference");
    const bulkField = await prepare("single_line_text_field", "bulk");
    values.push({ ownerId: product.id, definition: bulkField });
    const bulkRows = [
      {
        ownerType: "PRODUCT",
        ownerId: product.id,
        namespace: bulkField.namespace,
        key: bulkField.key,
        type: bulkField.type,
        value: "Imported fixture",
      },
      {
        ownerType: "PRODUCT",
        ownerId: product.id,
        namespace: primary.definition.namespace,
        key: primary.definition.key,
        type: "number_integer",
        value: "0",
      },
      {
        ownerType: "PRODUCT",
        ownerId: product.id,
        namespace: primary.definition.namespace,
        key: primary.definition.key,
        type: primary.definition.type,
        value: "Proposed conflict",
      },
    ];
    const preview = await previewImport(
      admin,
      db,
      shop,
      exportValueCsv(bulkRows),
    );
    jobIds.push(preview.id);
    assert.deepEqual(
      preview.rows.map((r) => r.valid),
      [true, false, true],
    );
    must(
      await mutateValue(admin, {
        action: "set",
        ownerId: product.id,
        definition: primary.definition,
        value: "Concurrent probe edit",
      }),
    );
    const done = await runImportChunk(admin, db, shop, {
      id: preview.id,
      revision: preview.revision,
      confirm: `APPLY:${preview.id}:${preview.inputHash}`,
    });
    assert.deepEqual(
      done.results.map((r) => r.status),
      ["saved", "invalid", "conflict"],
    );
    assert.equal(
      (
        await readResourceValue(
          admin,
          "PRODUCT",
          product.id,
          bulkField.namespace,
          bulkField.key,
        )
      ).value,
      "Imported fixture",
    );
    await assert.rejects(
      readJob(db, "other-isolated-shop.myshopify.com", done.id),
    );
    const resumed = await runImportChunk(admin, db, shop, {
      id: done.id,
      revision: done.revision,
      confirm: `APPLY:${done.id}:${done.inputHash}`,
    });
    assert.equal(resumed.status, "complete");
    report.bulk = {
      preview: true,
      apply: true,
      mixedRows: true,
      conflict: true,
      completedResume: true,
      shopIsolation: true,
    };
    const hasPlan = await hasActivePlan(admin);
    const diagnostics = await featureDiagnostics(admin, hasPlan, {
      database: "reachable",
      environment: "staging",
    });
    assert.equal(diagnostics.hasActivePlan, hasPlan);
    assert.equal(
      diagnostics.features.metaobjects.ready,
      hasPlan && diagnostics.features.metaobjects.missing.length === 0,
    );
    report.diagnostics = {
      scopesRead: true,
      planGatePreserved: true,
      actualHasActivePlan: hasPlan,
      missingOptionalScopes: diagnostics.features.fileReferences.missing,
    };
    report.metaobjects = {
      create: true,
      list: true,
      entryCreate: true,
      entryUpdate: true,
      omittedFieldsPreserved: true,
      definitionRename: true,
      referenceWrite: true,
    };
  } catch (error) {
    originalError = error;
    report.failure = error.message;
    throw error;
  } finally {
    const failures = [];
    for (const value of values)
      try {
        must(await mutateValue(admin, { action: "delete", ...value }));
      } catch (error) {
        failures.push({ kind: "advanced value", ownerId: value.ownerId, key: value.definition.key, error: error.message });
      }
    for (const field of fields)
      try {
        must(await removeDefinition(admin, [field], field));
      } catch (error) {
        failures.push({ kind: "advanced definition", id: field.id, key: field.key, error: error.message });
      }
    if (metaEntry && metaDefinition)
      try {
        const current = await readMetaobjectEntry(
          admin,
          metaEntry.id,
          metaDefinition.type,
        );
        await removeMetaobjectEntry(admin, metaDefinition, {
          id: metaEntry.id,
          updatedAt: current.updatedAt,
          confirm: `DELETE_ENTRY:${metaEntry.id}:${current.handle}`,
        });
        report.metaobjects = { ...report.metaobjects, entryDelete: true };
      } catch (error) {
        failures.push({ kind: "metaobject entry", id: metaEntry.id, error: error.message });
      }
    if (metaDefinition)
      try {
        const selected = (await listMetaobjectDefinitions(admin)).find(
          (d) => d.id === metaDefinition.id,
        );
        await removeEmptyMetaobjectDefinition(
          admin,
          selected,
          `DELETE_EMPTY_DEFINITION:${selected.id}:${selected.type}`,
        );
        report.metaobjects = {
          ...report.metaobjects,
          emptyDefinitionDelete: true,
        };
      } catch (error) {
        failures.push({ kind: "metaobject definition", id: metaDefinition.id, error: error.message });
      }
    if (jobIds.length)
      await db.metafieldJob.deleteMany({ where: { shop, id: { in: jobIds } } });
    report.cleanup = failures.length === 0;
    report.cleanupFailures = failures;
    console.log("advanced_probe=" + JSON.stringify(report));
    if (failures.length)
      throw new Error("Advanced fixture cleanup failed; see identity-scoped diagnostics.", { cause: originalError });
  }
  return report;
}
