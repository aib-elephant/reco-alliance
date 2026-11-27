import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFirstTable,
  rowsWithPolicyNumber,
} from "../lib/parsers/table-utils.ts";

const headers = [
  "Invoice Number",
  "Invoice Date",
  "Office Code",
  "Policy Number",
  "Endorsement Number",
  "LOB Code",
  "Insured Name",
  "Insured Type",
  "Policy Month",
  "Policy Inception Date ",
  "Policy Expiry Date ",
  "Brokerage Percentage",
  "Premium",
  "Brokerage",
];
const detail = (invoice, policy, brokerage) => [
  invoice,
  "2026-09-01",
  invoice ? "120300" : "",
  policy,
  ":",
  "44",
  "Example Company",
  "Organizational",
  "September",
  "2026-09-01",
  "2027-09-01",
  12.5,
  100,
  brokerage,
];

test("intermediate subtotal does not terminate the first table; grand total does", () => {
  const rows = [
    { rowNumber: 9, values: detail("INV-A", "POL-A", 10) },
    {
      rowNumber: 10,
      values: [
        "INV-A Total",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        12.5,
        100,
        10,
      ],
    },
    { rowNumber: 11, values: detail("INV-B", "POL-B", 20) },
    {
      rowNumber: 12,
      values: [
        null,
        null,
        null,
        "POL-C",
        null,
        null,
        "Another Company",
        null,
        null,
        null,
        null,
        12.5,
        50,
        5,
      ],
    },
    {
      rowNumber: 13,
      values: [
        "INV-B Total",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        150,
        25,
      ],
    },
    {
      rowNumber: 14,
      values: [
        "Grand Total",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        250,
        35,
      ],
    },
    { rowNumber: 15, values: ["3"] },
    {
      rowNumber: 16,
      values: [
        "Invoice Number",
        "Invoice Date",
        "Taxable Amount",
        "CGST Input",
        "SGST Input",
      ],
    },
    { rowNumber: 17, values: ["INV-A", "2026-09-01", 10, 1, 1] },
  ];
  const table = buildFirstTable("Sheet1", 8, headers, rows, ["Total"]);
  assert.equal(table.rows.length, 6);
  assert.deepEqual(
    table.rows.map((row) => row.rowType),
    ["detail", "subtotal", "detail", "detail", "subtotal", "grand_total"],
  );
  assert.deepEqual(
    table.rows.map((row) => row.rowNumber),
    [9, 10, 11, 12, 13, 14],
  );
  assert.equal(table.rows[3].rawData["Invoice Number"], null);
  assert.equal(table.rows[3].effectiveData["Invoice Number"], "INV-B");
  assert.equal(table.rows[3].effectiveData["Office Code"], "120300");
  assert.equal(table.rows[5].rawData["Invoice Number"], "Grand Total");
});

test("a second header ends first-table import even without Grand Total", () => {
  const rows = [
    { rowNumber: 9, values: detail("INV-A", "POL-A", 10) },
    {
      rowNumber: 10,
      values: [
        "Invoice Number",
        "Invoice Date",
        "Taxable Amount",
        "CGST Input",
        "SGST Input",
      ],
    },
    { rowNumber: 11, values: ["INV-A", "2026-09-01", 10, 1, 1] },
  ];
  const table = buildFirstTable("Sheet1", 8, headers, rows);
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0].rowNumber, 9);
});

test("a subtotal resets invoice number carry-down", () => {
  const rows = [
    { rowNumber: 9, values: detail("INV-A", "POL-A", 10) },
    { rowNumber: 10, values: ["INV-A Total"] },
    {
      rowNumber: 11,
      values: [null, null, null, "POL-B", null, "44", "New Policy Holder"],
    },
  ];
  const table = buildFirstTable("Sheet1", 8, headers, rows);
  assert.equal(table.rows[2].effectiveData["Invoice Number"], null);
});

test("policy report stores all populated-policy details and skips totals or blank policies", () => {
  const rows = [
    { rowNumber: 9, values: detail("INV-A", "POL-A", 10) },
    { rowNumber: 10, values: ["INV-A Total"] },
    { rowNumber: 11, values: detail("INV-B", "POL-B", 20) },
    {
      rowNumber: 12,
      values: [null, null, null, "  ", null, "44", "Unknown Policy Holder"],
    },
    {
      rowNumber: 13,
      values: [null, null, null, "POL-C", null, "44", "Another Policy Holder"],
    },
    { rowNumber: 14, values: ["Grand Total"] },
    {
      rowNumber: 15,
      values: [
        "Invoice Number",
        "Invoice Date",
        "Taxable Amount",
        "CGST Input",
      ],
    },
  ];
  const table = buildFirstTable("Sheet1", 8, headers, rows);
  assert.deepEqual(
    rowsWithPolicyNumber(table).map((row) => row.rowNumber),
    [9, 11, 13],
  );
  assert.deepEqual(
    rowsWithPolicyNumber(table).map((row) => row.rawData["Policy Number"]),
    ["POL-A", "POL-B", "POL-C"],
  );
  assert.equal(Object.keys(rowsWithPolicyNumber(table)[0].rawData).length, 14);
});

test("other document layouts without Policy Number are unchanged", () => {
  const table = buildFirstTable(
    "Sheet1",
    1,
    ["Invoice Number", "Amount"],
    [
      { rowNumber: 2, values: ["INV-A", 100] },
      { rowNumber: 3, values: ["Grand Total", 100] },
    ],
  );
  assert.deepEqual(
    rowsWithPolicyNumber(table).map((row) => row.rowNumber),
    [2, 3],
  );
});

test("recognizes alternate Policy No header", () => {
  const table = buildFirstTable(
    "Sheet1",
    1,
    ["Policy No.", "Premium"],
    [
      { rowNumber: 2, values: ["PN-100", 100] },
      { rowNumber: 3, values: [null, 200] },
      { rowNumber: 4, values: ["Grand Total", 300] },
    ],
  );
  assert.deepEqual(
    rowsWithPolicyNumber(table).map((row) => row.rowNumber),
    [2],
  );
});

test("approved Policy Number mapping filters MP No and preserves all raw columns", () => {
  const table = buildFirstTable(
    "Company A",
    1,
    ["MP No", "Amount", "Insured Name"],
    [
      { rowNumber: 2, values: ["MP-001", 100, "Alice"] },
      { rowNumber: 3, values: [null, 200, "Subtotal placeholder"] },
      { rowNumber: 4, values: ["MP-002", 300, "Bob"] },
      { rowNumber: 5, values: ["Grand Total", null, null] },
    ],
  );
  const kept = rowsWithPolicyNumber(table, {
    approvedMappings: { "Policy Number": ["MP No"] },
  });
  assert.deepEqual(
    kept.map((r) => r.rowNumber),
    [2, 4],
  );
  assert.deepEqual(
    kept.map((r) => r.rawData),
    [
      { "MP No": "MP-001", Amount: 100, "Insured Name": "Alice" },
      { "MP No": "MP-002", Amount: 300, "Insured Name": "Bob" },
    ],
  );
});

test("global Key Mapper aliases can find Pol Number without a saved policy mapping", () => {
  const table = buildFirstTable(
    "Company B",
    1,
    ["Pol Number", "Amount"],
    [
      { rowNumber: 2, values: ["P-01", 150] },
      { rowNumber: 3, values: [null, 250] },
      { rowNumber: 4, values: ["P-02", 350] },
    ],
  );
  const kept = rowsWithPolicyNumber(table, {
    approvedMappings: { Amount: ["Amount"] },
    keyMapperAliases: ["MP Number", "Pol Number", "MP No"],
  });
  assert.deepEqual(
    kept.map((r) => r.rowNumber),
    [2, 4],
  );
});

test("an approved mapping overrides a different Key Mapper alias", () => {
  const table = buildFirstTable(
    "Company C",
    1,
    ["MP No", "Pol Number", "Amount"],
    [
      { rowNumber: 2, values: [null, "POL-01", 100] },
      { rowNumber: 3, values: ["MP-02", null, 200] },
    ],
  );
  const kept = rowsWithPolicyNumber(table, {
    approvedMappings: { "Policy Number": ["Pol Number"] },
    keyMapperAliases: ["MP No", "Pol Number"],
  });
  assert.deepEqual(
    kept.map((r) => r.rowNumber),
    [2],
  );
});

test("ambiguous Key Mapper aliases require an explicit approved mapping", () => {
  const table = buildFirstTable(
    "Multiple aliases",
    1,
    ["MP No", "Pol Number", "Amount"],
    [{ rowNumber: 2, values: ["A", "B", 100] }],
  );
  assert.throws(
    () =>
      rowsWithPolicyNumber(table, {
        keyMapperAliases: ["MP No", "Pol Number"],
      }),
    /Multiple Policy Number aliases found/,
  );
});

test("stale approved policy column fails safely instead of silently importing totals", () => {
  const table = buildFirstTable(
    "Wrong Format",
    1,
    ["MP No", "Amount"],
    [{ rowNumber: 2, values: ["MP-101", 100] }],
  );
  assert.throws(
    () =>
      rowsWithPolicyNumber(table, {
        approvedMappings: { "Policy Number": ["Missing Column"] },
        keyMapperAliases: ["MP No"],
      }),
    /Approved Policy Number column was not found/,
  );
});
