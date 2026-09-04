const PROFILES = Object.freeze({
  production: Object.freeze({
    allowImplicitIngestion: true,
    claudeServer: "plugin:kindling:kindling",
    codexServer: "kindling",
    displayName: "Kindling",
    environment: "production",
    mcpUrl: "https://api.kindling.team/mcp",
    pluginId: "kindling",
    pluginSelector: "kindling@supercharge",
    reportPrefix: "KIR",
    sourceSkill: "kindling-source-ingestion",
    stateNamespace: null,
  }),
  staging: Object.freeze({
    allowImplicitIngestion: false,
    claudeServer: "plugin:kindling-staging:kindling-staging",
    codexServer: "kindling-staging",
    displayName: "Kindling Staging",
    environment: "staging",
    mcpUrl: "https://api.staging.kindling.team/mcp",
    pluginId: "kindling-staging",
    pluginSelector: "kindling-staging@supercharge",
    reportPrefix: "KISR",
    sourceSkill: "kindling-staging-source-ingestion",
    stateNamespace: "staging",
  }),
});

const BUILD_ENVIRONMENT =
  typeof __KINDLING_BUILD_ENVIRONMENT__ === "string"
    ? __KINDLING_BUILD_ENVIRONMENT__
    : "production";
const BUILD_LOCKED =
  typeof __KINDLING_BUILD_LOCKED__ === "boolean"
    ? __KINDLING_BUILD_LOCKED__
    : false;

let activeEnvironment = normalizeEnvironment(BUILD_ENVIRONMENT);

export function normalizeEnvironment(value) {
  const environment = String(value ?? "production")
    .trim()
    .toLowerCase();
  if (!Object.hasOwn(PROFILES, environment)) {
    throw new Error("--environment must be production or staging");
  }
  return environment;
}

export function configureEnvironment(value) {
  if (value !== undefined && value !== null && value !== "") {
    const requested = normalizeEnvironment(value);
    if (BUILD_LOCKED && requested !== normalizeEnvironment(BUILD_ENVIRONMENT)) {
      throw new Error(
        `this plugin bundle is locked to ${normalizeEnvironment(BUILD_ENVIRONMENT)}`,
      );
    }
    activeEnvironment = requested;
  }
  return getEnvironmentProfile();
}

export function getEnvironmentProfile(environment = activeEnvironment) {
  return PROFILES[normalizeEnvironment(environment)];
}

export function isReportIdForProfile(
  reportId,
  profile = getEnvironmentProfile(),
) {
  return new RegExp(
    `^${profile.reportPrefix}-\\d{8}-\\d{6}-[a-f0-9]{4}$`,
    "i",
  ).test(String(reportId));
}

export function reportTargetMatchesProfile(
  report,
  profile = getEnvironmentProfile(),
) {
  const environment = report.target_environment ?? "production";
  const mcpUrl = report.target_mcp_resource ?? PROFILES.production.mcpUrl;
  const pluginId = report.target_plugin ?? PROFILES.production.pluginId;
  return (
    environment === profile.environment &&
    mcpUrl === profile.mcpUrl &&
    pluginId === profile.pluginId
  );
}
