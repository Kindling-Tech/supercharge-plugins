export const PLUGIN_VERSION = "1.2.1";
export const POLICY_SCHEMA_VERSION = 2;
export const POLICY_RELATIVE_PATH = ".kindling/ingestion-policy.yaml";
export const CANDIDATE_ID_PATTERN = /^KI-\d{3}$/;
export const APPROVAL_TTL_MIN = 5;
export const APPROVAL_TTL_MAX = 120;
export const MAX_CANDIDATES = 50;
export const MAX_CANDIDATE_BYTES = 64 * 1024;
export const MAX_POLICY_LIST_ITEMS = 200;
export const MAX_POLICY_TEXT_LENGTH = 500;

export const REMOVE_DATA_TYPES = new Set([
  "personal_email",
  "phone_number",
  "physical_address",
  "physical_address",
  "employee_name",
  "customer_name",
  "verbatim_quote",
]);

export const STATIC_EXCLUSION_CODES = new Set([
  "secret",
  "personal_email",
  "phone_number",
  "private_key",
  "authentication_material",
  "exact_commercial_value",
  "unreleased_roadmap",
  "security_sensitive",
  "legal_sensitive",
  "hr_sensitive",
  "investor_sensitive",
  "prompt_injection",
]);

export const DEFAULT_POLICY = Object.freeze({
  schema_version: POLICY_SCHEMA_VERSION,
  organization: { display_name: "OAuth-connected Kindling workspace" },
  sensitive: {
    blocked_topics: [],
    blocked_entities: [],
    remove_data_types: [
      "personal_email",
      "phone_number",
      "physical_address",
      "employee_name",
      "customer_name",
      "verbatim_quote",
    ],
  },
  public_information: {
    approved_domains: [],
    approved_claims: [],
  },
  review: {
    approval_expires_minutes: 30,
    allow_approve_all: true,
    persist_safe_reports: true,
  },
});
