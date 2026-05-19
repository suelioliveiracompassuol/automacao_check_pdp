// =============================================================================
// ENDPOINT RULES FOR PDP MONITORING
// =============================================================================

import { EndpointRule } from "../endpointResponse.js";

/**
 * Critical API calls expected during PDP page load.
 * Each rule captures matching network responses and validates
 * status codes and optional body fields.
 */
export const PDP_ENDPOINT_RULES: EndpointRule[] = [
  {
    key: "product_page",
    name: "API de dados do produto (/pages/product)",
    match: "/pages/product/",
    nonEmptyFields: ["productId"],
  },
  {
    key: "product_page_v2",
    name: "API de dados do produto v2 (/pages/v2/product)",
    match: "/pages/v2/product/",
    nonEmptyFields: ["productId"],
  },
  {
    key: "reviews",
    name: "API de avaliações (/reviews/v2/)",
    match: "/reviews/v2/",
  },
  {
    key: "ratings",
    name: "API de ratings (/reviews/v2?productIds)",
    match: "/reviews/v2?productIds",
  },
];
