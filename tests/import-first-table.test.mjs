import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFirstTable } from '../lib/parsers/table-utils.ts';

const headers = [
  'Invoice Number', 'Invoice Date', 'Office Code', 'Policy Number',
  'Endorsement Number', 'LOB Code', 'Insured Name', 'Insured Type',
  'Policy Month', 'Policy Inception Date ', 'Policy Expiry Date ',
  'Brokerage Percentage', 'Premium', 'Brokerage',
];
const detail = (invoice, policy, brokerage) => [
  invoice, '2026-09-01', invoice ? '120300' : '', policy,
  ':', '44', 'Example Company', 'Organizational', 'September',
  '2026-09-01', '2027-09-01', 12.5, 100, brokerage,
];

test('intermediate subtotal does not terminate the first table; grand total does', () => {
  const rows = [
    { rowNumber: 9, values: detail('INV-A', 'POL-A', 10) },
    { rowNumber: 10, values: ['INV-A Total', null, null, null, null, null, null, null, null, null, null, 12.5, 100, 10] },
    { rowNumber: 11, values: detail('INV-B', 'POL-B', 20) },
    { rowNumber: 12, values: [null, null, null, 'POL-C', null, null, 'Another Company', null, null, null, null, 12.5, 50, 5] },
    { rowNumber: 13, values: ['INV-B Total', null, null, null, null, null, null, null, null, null, null, null, 150, 25] },
    { rowNumber: 14, values: ['Grand Total', null, null, null, null, null, null, null, null, null, null, null, 250, 35] },
    { rowNumber: 15, values: ['3'] },
    { rowNumber: 16, values: ['Invoice Number', 'Invoice Date', 'Taxable Amount', 'CGST Input', 'SGST Input'] },
    { rowNumber: 17, values: ['INV-A', '2026-09-01', 10, 1, 1] },
  ];
  const table = buildFirstTable('Sheet1', 8, headers, rows, ['Total']);
  assert.equal(table.rows.length, 6);
  assert.deepEqual(table.rows.map((row) => row.rowType),
    ['detail', 'subtotal', 'detail', 'detail', 'subtotal', 'grand_total']);
  assert.deepEqual(table.rows.map((row) => row.rowNumber), [9, 10, 11, 12, 13, 14]);
  assert.equal(table.rows[3].rawData['Invoice Number'], null);
  assert.equal(table.rows[3].effectiveData['Invoice Number'], 'INV-B');
  assert.equal(table.rows[3].effectiveData['Office Code'], '120300');
  assert.equal(table.rows[5].rawData['Invoice Number'], 'Grand Total');
});

test('a second header ends first-table import even without Grand Total', () => {
  const rows = [
    { rowNumber: 9, values: detail('INV-A', 'POL-A', 10) },
    { rowNumber: 10, values: ['Invoice Number', 'Invoice Date', 'Taxable Amount', 'CGST Input', 'SGST Input'] },
    { rowNumber: 11, values: ['INV-A', '2026-09-01', 10, 1, 1] },
  ];
  const table = buildFirstTable('Sheet1', 8, headers, rows);
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0].rowNumber, 9);
});

test('a subtotal resets invoice number carry-down', () => {
  const rows = [
    { rowNumber: 9, values: detail('INV-A', 'POL-A', 10) },
    { rowNumber: 10, values: ['INV-A Total'] },
    { rowNumber: 11, values: [null, null, null, 'POL-B', null, '44', 'New Policy Holder'] },
  ];
  const table = buildFirstTable('Sheet1', 8, headers, rows);
  assert.equal(table.rows[2].effectiveData['Invoice Number'], null);
});
