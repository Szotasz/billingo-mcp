---
name: issue-invoice
description: Issue a Hungarian invoice (számla) in Billingo correctly. Use when the user asks to invoice a customer, bill a service, or create an invoice, proforma or advance invoice with create_document.
---

# Issuing an invoice in Billingo

An issued invoice cannot be edited or deleted. It goes to the NAV (the Hungarian tax authority) and can only be undone with a cancellation (sztornó). Get it right before issuing.

## Before you call create_document

1. **Check that it was not invoiced already.** Search with `list_documents` (`query` with the customer's name, or `partner_id`, and a date range). A retry, a second message about the same sale or a payment that arrived twice is not a reason for a second invoice for one sale.
2. **Find the partner.** `list_partners` with the customer's name. Reuse an existing partner instead of creating a near-duplicate; if the existing one lacks the tax number, complete it with `update_partner`. A new partner: see the `add-partner-with-tax-number` skill.
3. **Pick the document block.** `list_document_blocks` gives the `block_id` values (invoice pads). Never guess a block id.
4. **Collect the required fields.** The API requires `partner_id`, `block_id`, `type`, `fulfillment_date`, `due_date`, `payment_method`, `language` and `currency`. The tool defaults `language` to `hu` and `currency` to `HUF`; set them when the customer needs another language or currency.

## The items

- **Net or gross.** Ask whether the agreed price is net or gross if the user did not say. With `unit_price_type: "net"` the VAT is added on top (gross = net x (1 + rate)); with `"gross"` the price already contains it. Never recompute a stated price backwards without asking.
- **The VAT rate is not yours to choose.** 27% is the general Hungarian rate, but the correct code depends on the seller and the transaction: a seller under the subject exemption (alanyi adómentes) uses `AAM`; a domestic reverse-charge or an EU or foreign customer can need a special code. If anything suggests the sale is not a plain domestic one (a foreign tax number, a foreign seat), stop and ask the user or their accountant. Do not decide the tax treatment from an email address or a web domain.
- **Dates.** `fulfillment_date` is the date of the service or delivery (teljesítés). For `due_date`, "N days" means calendar days unless the user says working days.

## Payment method

See the `choose-payment-method` skill. In short: a transfer after the invoice is `wire_transfer`, a prepayment is `elore_utalas`, a card payment already taken online is `online_bankcard` with `paid: true`.

## Issuing

- The server shows a summary and asks for confirmation before it issues a non-draft document. Read the summary with the user: partner and tax number, items, net, VAT and gross totals, payment method, where the email goes.
- When in doubt, create a `draft` first; a draft needs no confirmation and can be turned into an invoice with `create_from_draft`.

## After issuing

- To be sure the customer receives it, send it explicitly with `send_document` to the address the customer gave, and give the user the link from `get_document_public_url` as well.
- Check the NAV status a few minutes later with `get_online_szamla_status`; `sent` is not yet accepted. See the `handle-nav-rejection` skill.
