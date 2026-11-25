import { z } from "zod";

/**
 * Billingo API v3 PaymentMethod values (the same list for documents, payments and spending).
 * Source: the API spec 3.0.14 (PaymentMethod and SpendingPaymentMethod enums).
 * Note the two transfer values: `wire_transfer` is a bank transfer paid after the invoice,
 * `elore_utalas` is a prepayment. There is no `artutalas` value: the API answers 422 to it.
 */
export const PAYMENT_METHODS = [
  "aruhitel",
  "bankcard",
  "barion",
  "barter",
  "cash",
  "cash_on_delivery",
  "coupon",
  "elore_utalas",
  "ep_kartya",
  "kompenzacio",
  "levonas",
  "online_bankcard",
  "other",
  "paylike",
  "payoneer",
  "paypal",
  "paypal_utolag",
  "payu",
  "pick_pack_pont",
  "postai_csekk",
  "postautalvany",
  "skrill",
  "szep_card",
  "transferwise",
  "upwork",
  "utalvany",
  "valto",
  "wire_transfer",
] as const;

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
