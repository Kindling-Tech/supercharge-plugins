import { readFile } from "node:fs/promises";
import YAML from "yaml";
import {
  APPROVAL_TTL_MAX,
  APPROVAL_TTL_MIN,
  DEFAULT_POLICY,
  MAX_POLICY_LIST_ITEMS,
  MAX_POLICY_TEXT_LENGTH,
  POLICY_SCHEMA_VERSION,
  REMOVE_DATA_TYPES,
} from "./constants.mjs";
import { canonicalize, sha256 } from "./canonical.mjs";

const TOP_LEVEL_KEYS = new Set([
  "schema_version",
  "organization",
  "sensitive",
  "public_information",
  "review",
]);
const ORGANIZATION_KEYS = new Set(["display_name"]);
const SENSITIVE_KEYS = new Set([
  "blocked_topics",
  "blocked_entities",
  "remove_data_types",
]);
const BLOCKED_ENTITY_KEYS = new Set(["name", "category"]);
const PUBLIC_INFORMATION_KEYS = new Set([
  "approved_domains",
  "approved_claims",
]);
const APPROVED_CLAIM_KEYS = new Set([
  "id",
  "text",
  "approved_by",
  "approved_on",
]);
const REVIEW_KEYS = new Set([
  "approval_expires_minutes",
  "allow_approve_all",
  "persist_safe_reports",
]);

const STATIC_RULES = [
  {
    code: "private_key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  },
  {
    code: "secret",
    pattern:
      /\b(?:sk-[A-Za-z0-9_-]{16,}|mcp_live_[A-Za-z0-9_-]+|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,})\b/,
  },
  {
    code: "authentication_material",
    pattern:
      /\b(?:authorization\s*:\s*bearer|api[_ -]?key|access[_ -]?token|password\s*[:=])\b/i,
  },
  {
    code: "personal_email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
  {
    code: "phone_number",
    pattern: /(?:\+?\d[\d ()-]{7,}\d)/,
  },
  {
    code: "physical_address",
    pattern:
      /\b\d{1,6}\s+[A-Z0-9][A-Z0-9 .'-]{1,80}\s(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|court|ct)\b/i,
  },
  {
    code: "exact_commercial_value",
    pattern:
      /(?:[$€£]\s?\d[\d,.]*(?:\s?(?:k|m|million|thousand))?|\b\d[\d,.]*\s?(?:usd|aud|eur|gbp)\b)/i,
  },
  {
    code: "unreleased_roadmap",
    pattern:
      /\b(?:unreleased|under nda|embargoed|roadmap|not yet announced|launch date|next quarter feature)\b/i,
  },
  {
    code: "security_sensitive",
    pattern:
      /\b(?:security incident|data breach|vulnerability|exploit|zero[- ]day|penetration test finding)\b/i,
  },
  {
    code: "legal_sensitive",
    pattern:
      /\b(?:lawsuit|legal dispute|privileged and confidential|settlement agreement)\b/i,
  },
  {
    code: "hr_sensitive",
    pattern:
      /\b(?:compensation|salary|performance review|disciplinary|termination|candidate interview feedback)\b/i,
  },
  {
    code: "investor_sensitive",
    pattern:
      /\b(?:fundraising|term sheet|board meeting|acquisition offer|cap table|investor update)\b/i,
  },
  {
    code: "prompt_injection",
    pattern:
      /\b(?:ignore (?:all |the )?(?:previous|prior|above) instructions|system prompt|you are now|do not follow the skill)\b/i,
  },
];

export class PolicyValidationError extends Error {
  constructor(errors) {
    super(`invalid Kindling ingestion policy:\n- ${errors.join("\n- ")}`);
    this.name = "PolicyValidationError";
    this.errors = errors;
  }
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_POLICY));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rejectUnknown(object, allowed, path, errors) {
  if (!isPlainObject(object)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) errors.push(`${path}.${key} is not supported`);
  }
}

function readString(value, path, errors, { required = true } = {}) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${path} must be a non-empty string`);
    return "";
  }
  if (value.length > MAX_POLICY_TEXT_LENGTH) {
    errors.push(`${path} exceeds ${MAX_POLICY_TEXT_LENGTH} characters`);
  }
  return value.trim();
}

function readBoolean(value, path, errors, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    errors.push(`${path} must be true or false`);
    return fallback;
  }
  return value;
}

function readInteger(value, path, errors, { min, max, fallback }) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${path} must be an integer from ${min} to ${max}`);
    return fallback;
  }
  return value;
}

function readStringArray(value, path, errors, fallback = []) {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [...fallback];
  }
  if (value.length > MAX_POLICY_LIST_ITEMS) {
    errors.push(`${path} exceeds ${MAX_POLICY_LIST_ITEMS} items`);
  }
  const result = [];
  for (const [index, item] of value.entries()) {
    const parsed = readString(item, `${path}[${index}]`, errors);
    if (parsed) result.push(parsed);
  }
  return [...new Set(result)];
}

export function validatePolicy(input) {
  const errors = [];
  if (!isPlainObject(input))
    throw new PolicyValidationError(["policy root must be an object"]);
  rejectUnknown(input, TOP_LEVEL_KEYS, "policy", errors);

  if (input.schema_version !== POLICY_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${POLICY_SCHEMA_VERSION}`);
  }

  const defaults = cloneDefaults();
  const organization = input.organization ?? {};
  rejectUnknown(organization, ORGANIZATION_KEYS, "organization", errors);

  const sensitive = input.sensitive ?? {};
  rejectUnknown(sensitive, SENSITIVE_KEYS, "sensitive", errors);
  const blockedEntitiesInput = sensitive.blocked_entities ?? [];
  if (!Array.isArray(blockedEntitiesInput)) {
    errors.push("sensitive.blocked_entities must be an array");
  }
  if (
    Array.isArray(blockedEntitiesInput) &&
    blockedEntitiesInput.length > MAX_POLICY_LIST_ITEMS
  ) {
    errors.push(
      `sensitive.blocked_entities exceeds ${MAX_POLICY_LIST_ITEMS} items`,
    );
  }
  const blockedEntities = [];
  if (Array.isArray(blockedEntitiesInput)) {
    for (const [index, entity] of blockedEntitiesInput.entries()) {
      rejectUnknown(
        entity,
        BLOCKED_ENTITY_KEYS,
        `sensitive.blocked_entities[${index}]`,
        errors,
      );
      if (!isPlainObject(entity)) continue;
      const name = readString(
        entity.name,
        `sensitive.blocked_entities[${index}].name`,
        errors,
      );
      const category = readString(
        entity.category,
        `sensitive.blocked_entities[${index}].category`,
        errors,
      );
      if (name && category) blockedEntities.push({ category, name });
    }
  }

  const removeDataTypes = readStringArray(
    sensitive.remove_data_types,
    "sensitive.remove_data_types",
    errors,
    defaults.sensitive.remove_data_types,
  );
  for (const value of removeDataTypes) {
    if (!REMOVE_DATA_TYPES.has(value)) {
      errors.push(
        `sensitive.remove_data_types contains unsupported value ${JSON.stringify(value)}`,
      );
    }
  }

  const publicInformation = input.public_information ?? {};
  rejectUnknown(
    publicInformation,
    PUBLIC_INFORMATION_KEYS,
    "public_information",
    errors,
  );
  const claimsInput = publicInformation.approved_claims ?? [];
  if (!Array.isArray(claimsInput))
    errors.push("public_information.approved_claims must be an array");
  if (
    Array.isArray(claimsInput) &&
    claimsInput.length > MAX_POLICY_LIST_ITEMS
  ) {
    errors.push(
      `public_information.approved_claims exceeds ${MAX_POLICY_LIST_ITEMS} items`,
    );
  }
  const claims = [];
  const claimIds = new Set();
  if (Array.isArray(claimsInput)) {
    for (const [index, claim] of claimsInput.entries()) {
      rejectUnknown(
        claim,
        APPROVED_CLAIM_KEYS,
        `public_information.approved_claims[${index}]`,
        errors,
      );
      if (!isPlainObject(claim)) continue;
      const id = readString(
        claim.id,
        `public_information.approved_claims[${index}].id`,
        errors,
      );
      if (id && !/^[a-z0-9][a-z0-9_-]*$/i.test(id)) {
        errors.push(
          `public_information.approved_claims[${index}].id must be an identifier`,
        );
      }
      if (id && claimIds.has(id)) {
        errors.push(
          `public_information.approved_claims contains duplicate id ${JSON.stringify(id)}`,
        );
      }
      if (id) claimIds.add(id);
      const text = readString(
        claim.text,
        `public_information.approved_claims[${index}].text`,
        errors,
      );
      const approvedBy = readString(
        claim.approved_by,
        `public_information.approved_claims[${index}].approved_by`,
        errors,
        { required: false },
      );
      const approvedOn = readString(
        claim.approved_on,
        `public_information.approved_claims[${index}].approved_on`,
        errors,
        { required: false },
      );
      if (approvedOn && !/^\d{4}-\d{2}-\d{2}$/.test(approvedOn)) {
        errors.push(
          `public_information.approved_claims[${index}].approved_on must be YYYY-MM-DD`,
        );
      }
      if (id && text) {
        claims.push({
          id,
          text,
          ...(approvedBy ? { approved_by: approvedBy } : {}),
          ...(approvedOn ? { approved_on: approvedOn } : {}),
        });
      }
    }
  }

  const review = input.review ?? {};
  rejectUnknown(review, REVIEW_KEYS, "review", errors);

  const approvedDomains = readStringArray(
    publicInformation.approved_domains,
    "public_information.approved_domains",
    errors,
  );
  for (const domain of approvedDomains) {
    if (
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)
    ) {
      errors.push(
        `public_information.approved_domains contains invalid domain ${JSON.stringify(domain)}`,
      );
    }
  }

  const policy = {
    schema_version: POLICY_SCHEMA_VERSION,
    organization: {
      display_name:
        readString(
          organization.display_name,
          "organization.display_name",
          errors,
          {
            required: false,
          },
        ) ?? defaults.organization.display_name,
    },
    sensitive: {
      blocked_topics: readStringArray(
        sensitive.blocked_topics,
        "sensitive.blocked_topics",
        errors,
      ),
      blocked_entities: blockedEntities,
      remove_data_types: removeDataTypes,
    },
    public_information: {
      approved_domains: approvedDomains,
      approved_claims: claims,
    },
    review: {
      approval_expires_minutes: readInteger(
        review.approval_expires_minutes,
        "review.approval_expires_minutes",
        errors,
        {
          min: APPROVAL_TTL_MIN,
          max: APPROVAL_TTL_MAX,
          fallback: defaults.review.approval_expires_minutes,
        },
      ),
      allow_approve_all: readBoolean(
        review.allow_approve_all,
        "review.allow_approve_all",
        errors,
        defaults.review.allow_approve_all,
      ),
      persist_safe_reports: readBoolean(
        review.persist_safe_reports,
        "review.persist_safe_reports",
        errors,
        defaults.review.persist_safe_reports,
      ),
    },
  };

  if (errors.length) throw new PolicyValidationError(errors);
  return policy;
}

export function policyDigest(policy) {
  return sha256(canonicalize(validatePolicy(policy)));
}

export async function loadPolicy(path) {
  const source = await readFile(path, "utf8");
  const document = YAML.parseDocument(source, {
    maxAliasCount: 0,
    prettyErrors: true,
    uniqueKeys: true,
  });
  if (document.errors.length) {
    throw new PolicyValidationError(
      document.errors.map((error) => error.message),
    );
  }
  return validatePolicy(document.toJS({ maxAliasCount: 0 }));
}

export function renderPolicy(policy) {
  return YAML.stringify(validatePolicy(policy), { lineWidth: 100 });
}

export function defaultPolicy(overrides = {}) {
  const base = cloneDefaults();
  if (overrides.organizationName)
    base.organization.display_name = overrides.organizationName;
  if (overrides.blockedTopics)
    base.sensitive.blocked_topics = overrides.blockedTopics;
  if (overrides.blockedEntities) {
    base.sensitive.blocked_entities = overrides.blockedEntities.map((name) => ({
      name,
      category: "confidential_entity",
    }));
  }
  if (overrides.approvalMinutes)
    base.review.approval_expires_minutes = overrides.approvalMinutes;
  return validatePolicy(base);
}

export function scanCandidate(candidate, policy) {
  const normalizedPolicy = validatePolicy(policy);
  const text = `${candidate.title ?? ""}\n${candidate.content ?? ""}`;
  const findings = [];
  for (const rule of STATIC_RULES) {
    if (rule.pattern.test(text))
      findings.push({ code: rule.code, source: "static" });
  }
  const lowercase = text.toLocaleLowerCase("en");
  for (const topic of normalizedPolicy.sensitive.blocked_topics) {
    if (lowercase.includes(topic.toLocaleLowerCase("en"))) {
      findings.push({
        code: "blocked_topic",
        source: "customer_policy",
        value: topic,
      });
    }
  }
  for (const entity of normalizedPolicy.sensitive.blocked_entities) {
    if (lowercase.includes(entity.name.toLocaleLowerCase("en"))) {
      findings.push({
        category: entity.category,
        code: "blocked_entity",
        source: "customer_policy",
        value: entity.name,
      });
    }
  }
  const unique = new Map();
  for (const finding of findings) {
    unique.set(canonicalize(finding), finding);
  }
  return [...unique.values()];
}
