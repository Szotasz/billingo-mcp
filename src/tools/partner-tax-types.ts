import { z } from "zod";

/**
 * Billingo API v3 PartnerTaxType values a caller may set (create_partner, update_partner).
 * Source: the API spec on SwaggerHub (PartnerTaxType enum). The spec also has an empty string, the
 * "not set" state; here that is the field left out (optional). There is no `TAXPAYER` value: the API
 * answers success to it, but the partner's tax_type reads back empty.
 * The tax type decides the customer VAT status the invoice reports to the NAV.
 */
export const PARTNER_TAX_TYPES = ["FOREIGN", "HAS_TAX_NUMBER", "NO_TAX_NUMBER"] as const;

export const partnerTaxTypeSchema = z.enum(PARTNER_TAX_TYPES);
