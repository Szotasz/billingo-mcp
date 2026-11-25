---
name: handle-nav-rejection
description: Read a Billingo invoice's NAV Online Számla status and fix a rejected invoice with a cancellation and a correct reissue. Use when get_online_szamla_status shows an error or a rejection, when the user says an invoice is stuck at the NAV, or when an issued invoice has wrong data (for example a missing tax number).
---

# NAV status and fixing a rejected invoice

Every issued invoice is reported to the NAV (Online Számla). The report is asynchronous: the status changes over minutes.

## Reading the status

Use `get_online_szamla_status` with the `document_id`.

- **Accepted:** `done` with no validation error. Only this counts as success.
- **Not final yet:** `sent`, `received`, `processing` and similar. `sent` means the report left, not that the NAV accepted it; an invoice can sit at `sent` for a while and still end rejected. Check again later instead of reporting success.
- **Rejected or failed:** a validation error, an invalid tax number, a technical error, or an aborted report. Read the whole record, not only the first error field: the cause is often in the partner data (for example an empty or truncated tax number).

## An issued invoice cannot be edited

The partner data printed on an issued invoice does not change when you fix the partner record afterwards. A wrong invoice is fixed with a cancellation and a new invoice:

1. **Fix the cause first.** Usually the partner: get the correct, complete tax number (see the `add-partner-with-tax-number` skill) and set it on the existing partner with `update_partner`. Do not create a second partner for the same company.
2. **Check where the cancellation will be emailed.** Billingo may email the cancellation to the partner's current email addresses. If the partner record is shared (for example a generic partner used for several buyers), make sure its email is the right buyer's before cancelling.
3. **Cancel** the wrong invoice with `cancel_document`. This creates a cancellation document (sztornó) that also goes to the NAV, and marks the original as cancelled.
4. **Reissue** with `create_document` and the same data as the original (read it with `get_document`): the same partner (now with the corrected data), items, `fulfillment_date` (the original's), currency and language. Keep the real payment method and paid state (see `choose-payment-method`). Put a note in `comment` that this replaces the cancelled invoice and give its number.
5. **Verify both** with `get_online_szamla_status` until each reaches a final state.

## When the original was never accepted

If the original invoice was rejected by the NAV, its cancellation copies the same wrong partner data and is rejected too. That is expected and harmless: neither the original nor its cancellation was registered at the NAV. What matters is that the new invoice reaches `done`. Tell the user, so their bookkeeping knows about the pair.

## Do not double-bill

A failed report or a second payment notice is not a reason for a second invoice for the same sale. Two invoices are right only if there really were two payments for two sales.
