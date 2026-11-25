import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { encryptCredentials, decryptCredentials, encryptAttachment, decryptAttachment } from '../lib/email/crypto.ts';
import { isSupportedAttachment, assertAttachmentSize, decodeBase64Url, findAttachmentForRetry } from '../lib/email/attachment.service.ts';

test('supported spreadsheet attachment formats', () => {
  assert.equal(isSupportedAttachment('Sales.CSV'), true);
  assert.equal(isSupportedAttachment('reconciliation.xlsx'), true);
  assert.equal(isSupportedAttachment('report.xls'), false);
  assert.equal(isSupportedAttachment('invoice.pdf'), false);
});

test('base64url decoding and attachment size checks', () => {
  const source = Buffer.from('hello-world');
  assert.deepEqual(decodeBase64Url(source.toString('base64url')), source);
  assert.doesNotThrow(() => assertAttachmentSize(source));
  assert.throws(() => assertAttachmentSize(Buffer.alloc(0)), /empty/);
  assert.throws(() => assertAttachmentSize(Buffer.alloc(10 * 1024 * 1024 + 1)), /10 MB/);
});

test('encrypted credentials round trip and tamper detection', () => {
  process.env.MAILBOX_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const original = { access_token: 'abc', refresh_token: 'secret', expires_at: 123 };
  const encoded = encryptCredentials(original);
  assert.equal(encoded.startsWith('v1.'), true);
  assert.equal(encoded.includes('secret'), false);
  assert.deepEqual(decryptCredentials(encoded), original);
  assert.throws(() => decryptCredentials(encoded.slice(0, -3) + 'AA'));
});

// Company routing logic is intentionally testable without a live MongoDB.
const { matchCompanyFromSender, extractSenderAddress } = await import('../lib/email/sender-rules.ts');
test('extract sender with a display name', () => {
  assert.equal(extractSenderAddress('Vendor <Sales@Example.COM>'), 'sales@example.com');
  assert.equal(extractSenderAddress('not an email'), null);
});

test('exact sender beats general domain rule', () => {
  const outcome = matchCompanyFromSender({ sender: 'Special <billing@vendor.com>', documentType: 'invoice' }, [
    { id: 'a', allowedDomains: ['vendor.com'] },
    { id: 'b', senderEmails: ['billing@vendor.com'] },
  ]);
  assert.deepEqual(outcome, { status: 'matched', companyId: 'b', documentType: 'invoice', reason: 'exact_sender' });
});

test('ambiguous shared domains must never route to a random company', () => {
  const outcome = matchCompanyFromSender({ sender: 'finance@vendor.com', documentType: 'invoice' }, [
    { id: 'a', allowedDomains: ['vendor.com'] },
    { id: 'b', allowedDomains: ['vendor.com'] },
  ]);
  assert.equal(outcome.status, 'ambiguous');
  assert.deepEqual(outcome.candidates, ['a', 'b']);
});

test('unknown senders are not assigned a company', () => {
  const outcome = matchCompanyFromSender({ sender: 'unknown@elsewhere.net', documentType: 'invoice' }, [
    { id: 'a', senderEmails: ['billing@vendor.com'] },
  ]);
  assert.equal(outcome.status, 'unmatched');
});


test('encrypted attachment survives review retry and rejects tampering', () => {
  process.env.MAILBOX_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const original = randomBytes(256 * 1024);
  const encrypted = encryptAttachment(original);
  assert.equal(encrypted.ciphertext.equals(original), false);
  assert.deepEqual(decryptAttachment(encrypted), original);
  const corrupted = { ...encrypted, ciphertext: Buffer.from(encrypted.ciphertext) };
  corrupted.ciphertext[0] ^= 1;
  assert.throws(() => decryptAttachment(corrupted));
});

test('retry attachment lookup handles changed IDs without picking duplicate filenames', () => {
  const attachments = [
    { id: 'new-1', name: 'invoice.xlsx' },
    { id: 'new-2', name: 'other.xlsx' },
  ];
  assert.equal(findAttachmentForRetry(attachments, { id: 'old-id', name: 'INVOICE.xlsx' }), attachments[0]);
  assert.equal(findAttachmentForRetry(attachments, { id: 'new-2', name: 'incorrect.xlsx' }), attachments[1]);
  assert.equal(findAttachmentForRetry([...attachments, { id: 'new-3', name: 'invoice.xlsx' }],
    { id: 'old-id', name: 'invoice.xlsx' }), undefined);
  assert.equal(findAttachmentForRetry(attachments, { id: 'old-id', name: 'missing.xlsx' }), undefined);
});
