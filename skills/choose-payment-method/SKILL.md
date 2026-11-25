---
name: choose-payment-method
description: Choose the right Billingo payment_method and paid flag for an invoice, a correction or a payment record. Use when creating a document, a modification document, a spending or a payment, or when the user is unsure which payment method value to use.
---

# Choosing the payment method

`payment_method` takes only the values of the Billingo API (28 of them). There is no `artutalas` value; a bank transfer is one of the two values below.

## The common cases

| What happened | payment_method | paid |
|---|---|---|
| The customer pays by bank transfer after receiving the invoice | `wire_transfer` | `false` |
| Prepayment: the customer transfers before the fulfilment | `elore_utalas` | as the money arrived |
| The customer already paid online by card (for example through an online payment provider) | `online_bankcard` | `true` |
| Cash | `cash` | `true` if received |

- `wire_transfer` and `elore_utalas` are two different values. Use `elore_utalas` only when the user explicitly says it is a prepayment.
- `bankcard` (a card at a physical terminal) is also a valid value; use it only when the user says so.
- Other values exist for specific providers and instruments (`paypal`, `barion`, `szep_card`, `utalvany`, `kompenzacio` and more); use one only when the user names it.

## The paid flag

`paid` defaults to `false`. Set `paid: true` only when the money has actually arrived, for example a card payment taken online before the invoice. An invoice marked paid that was not paid misleads both the customer and the bookkeeping.

## Corrections and reissues

A correction (`create_modification_document`) or a reissued invoice keeps the real payment method and the real paid state of the original sale. If the original was paid online by card, the reissue is `online_bankcard` with `paid: true`, not `wire_transfer`.

## Recording a payment

`update_payment` records a payment on an existing invoice; use the method the money really came in with.
