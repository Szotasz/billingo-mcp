---
name: add-partner-with-tax-number
description: Create or update a Billingo partner (customer) with the right tax number and tax_type. Use before invoicing a new customer, when a customer is a company with a Hungarian or foreign tax number, or when a partner's tax data is wrong or empty.
---

# Adding a partner with a tax number

The partner's `tax_type` decides the customer VAT status the invoice reports to the NAV, and a wrong or empty tax number gets the invoice rejected. Set both right before the first invoice.

## Reuse before you create

Search with `list_partners` (name, and the tax number if you have it). If the company already exists, use that partner and complete it with `update_partner`. A second partner for the same company splits its invoices and often ends up without the tax number.

## The tax type

`tax_type` takes three values:

| The customer | tax_type | taxcode |
|---|---|---|
| A company or sole trader registered in Hungary, with a Hungarian tax number | `HAS_TAX_NUMBER` | the full Hungarian tax number |
| A private person, or anyone without a tax number | `NO_TAX_NUMBER` | leave it out |
| A company registered outside Hungary (EU or elsewhere) | `FOREIGN` | its own tax or VAT number |

A foreign company is `FOREIGN` even when it has an EU VAT number; Billingo reports it to the NAV as "other". A foreign customer can also change which VAT code the invoice needs; leave that decision to the user or their accountant (see `issue-invoice`).

## The Hungarian tax number

- It has 11 digits in three parts: 8 + 1 + 2, written with hyphens (törzsszám, ÁFA-kód, megyekód).
- Verify it with `check_tax_number` (the 8-digit base number) before using it; it returns the registered name and address, which should match the customer.
- Never use a shortened or partly typed number (for example one copied from a form field that cut it off). Ask for the full number or take it from the customer's own documents.

## After creating or updating

Read the partner back with `get_partner` and check that `tax_type` and `taxcode` are what you set. An empty value in the response is the stored state, not a pending one.

## Address

The address needs `country_code`, `post_code`, `city` and `address`. For a foreign partner use its own country code.
