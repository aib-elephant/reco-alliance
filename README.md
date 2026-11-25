# Data Reconciliation Solution — manual + automated email imports

This is the user's updated application with an added Gmail / Microsoft Graph integration. Existing Companies, Imports and Key Mapping screens are preserved.

## Setup

1. Install Node.js 20+ and MongoDB. Run `npm install`.
2. Copy `.env.example` to `.env.local`; configure `MONGODB_URI` and `APP_BASE_URL`.
3. Generate a **persistent** credentials encryption key and a separate OAuth state key (never commit these):

   ```sh
   node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
   ```

   Run twice and use the values for `MAILBOX_ENCRYPTION_KEY` and `OAUTH_STATE_SECRET`. **Do not rotate the encryption key without migrating encrypted credentials.**
4. Run `npm run dev`. Visit `/companies` to create active companies, including `senderEmails` and/or `allowedDomains` rules.
5. First validate spreadsheet field mappings through `/imports`. Unrecognized email file layouts will create a mapping review job, accessible at `/email`.
6. Set up OAuth using the provider directions below, then visit `/email`, choose a document type (defaults to `invoice`), and click **Connect Gmail** or **Connect Microsoft 365**.
7. Click **Sync now** to test. For continuous polling run `npm run inngest:dev` alongside `npm run dev` and in deployment configure Inngest webhook signing/event keys; the Inngest cron triggers every five minutes. Alternatively, call `POST /api/email/cron` from an external scheduler with `Authorization: Bearer $CRON_SECRET` (requires a working Inngest event key).

## Gmail OAuth setup

- Create an OAuth client of type **Web application** in Google Cloud Console, enable **Gmail API**, configure consent-screen test users / app verification as necessary.
- Add the exact redirect URI `http://localhost:3000/api/email/oauth/gmail/callback` (replace host with `APP_BASE_URL` in deployment).
- Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- The app requests Gmail read-only and the account email. Google may require verification to serve external production users.

## Microsoft 365 OAuth setup

- Create an Entra app registration, add Web redirect `http://localhost:3000/api/email/oauth/microsoft/callback` and delegated Microsoft Graph permissions **Mail.Read**, **User.Read**, and **offline_access**. Grant tenant consent where required.
- Configure `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` (`common` for multi-tenant accounts, or your tenant ID).
- The Microsoft adapter currently polls **Inbox** messages; attachments in other folders aren't processed.

## How email processing works

- Initial scan covers mail from the previous **30 days**; subsequent polls cover the period since the prior successful sync, with a **48-hour overlap**. Complete scans only advance `lastSyncedAt`. Gmail lists matching attachment messages; Graph lists Inbox messages and checks for attachments, using immutable message IDs to reduce duplicates when messages move.
- Messages are stored in `ProcessedEmail`, and each supported CSV/XLSX attachment gets its own `ImportJob`. A compound unique index prevents duplicate imports from repeat scans. Provider credentials are encrypted with AES-256-GCM at rest.
- The sender is matched to **exactly one active company** using `senderEmails` preferentially, then `allowedDomains`. Ambiguous or unknown senders go to `needs_review`, with no import. Sender headers are **not proof of authentication**: enforce provider-side trust/anti-spoofing controls for sensitive use cases.
- Existing active mapping for company/document type/layout is reused. A new layout creates a draft mapping and `needs_review` import job. Approve the mapping under the company mapping route, then retry in `/email`, or let the next scheduled scan retry automatically.
- Attached file bytes aren't stored; retry re-downloads them from the provider. Missing attachments cannot be replayed unless the original email remains accessible.
- The import page continues to support manual CSV/XLSX uploads.

## HTTP routes

- `GET /api/email/connections` — list connected mailboxes, without secrets.
- `GET /api/email/oauth/{gmail|microsoft}/start?documentType=invoice` — begin OAuth.
- `GET /api/email/oauth/{provider}/callback` — CSRF-checked OAuth callback.
- `POST /api/email/connections/{id}/sync` — sync mailbox immediately.
- `GET /api/email/jobs` — latest email import jobs and unmatched senders.
- `POST /api/email/imports/{id}/retry` — retry failed or mapping-reviewed import.
- `POST /api/email/messages/{id}/retry` — retry an unmatched sender after updating company rules.
- `POST /api/email/cron` — authenticated scheduler (queues Inngest events).
- `/api/inngest` — Inngest function entrypoint (sync + five-minute schedule).

## Notes and limitations

- **Production login/tenant authorization is not finished**. `ENABLE_DEV_ADMIN=true` works **only outside production**; don't expose local dev servers publicly. `ADMIN_API_KEY` is for service-to-service calls only and can't authenticate an OAuth browser redirect. Replace with authenticated users + per-tenant authorization before production rollout. At present, connected mailboxes are instance-wide and company matching depends on configured sender rules.
- Requires real provider OAuth credentials, MongoDB and Inngest to verify end-to-end; no real mailbox was accessed during development.
- A polling MVP, not webhook-based: Gmail Pub/Sub and Graph subscriptions/delta processing aren't implemented yet. The selected document type currently applies to the entire mailbox; mixed document types require additional routing rules. No multi-mailbox sharding, backfill UI, provider MIME virus scanning, or SLA guarantees. Inngest triggers must be deployed/enabled to run automatically.
- The scan is bounded at **2,000 messages per poll per mailbox**. For larger mailboxes, widen the implementation to cursor/delta pagination before going live. An exceeded bound aborts watermark advance. Mailbox leases expire after 30 minutes; don't run more than one active poll per mailbox.
- Attachments over 10 MiB, formats other than CSV/XLSX, and embedded archives aren't imported.
- Some email or attachment errors produce `failed` jobs. The Retry control handles those; `needs_review` jobs retry after mapping approval. Unmatched senders require a manual **Retry routing** action after company rules change.
- Existing installations may have an old sparse unique `ImportJob` index that mistakenly constrains manual uploads. **Inspect indexes and migrate** if necessary: in Mongo shell `db.importjobs.getIndexes()`, then remove the old index named `provider_1_mailboxAddress_1_providerMessageId_1_attachmentId_1` (if present) and let Mongoose create `unique_email_attachment` (a partial index). Back up data first; don't drop indexes blindly.
- No real OAuth integration or database tests were run against live accounts. Build/type/lint check status is documented in the delivery summary.

## Developer checks

- `npm run test:email` (Node.js 22+ for built-in TypeScript type-stripping) runs local unit tests for encrypted credentials, supported attachments, and sender routing.
- Run `npm run build` and `npm run lint` after dependency installation. Set up a disposable mailbox and MongoDB to perform real end-to-end testing before production.
