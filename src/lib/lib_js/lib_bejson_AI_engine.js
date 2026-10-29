/**
 * Library:         lib_bejson_AI_engine.js
 * Family:          AI
 * Module Purpose:  AI model execution engine, extension rule binding, and True/False gated plugin system for job execution.
 * Architecture:    BEJSON 104a AI plugin gate architecture supporting rule binding, passive extension ingestion, and gated execution.
 * Version:         3.1.14
 * Release_Version: 300
 * Date:            2026-10-28
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   7c9082a1-12ef-45a8-92b0-9114b01e9124
 */

import {
  E_AI_PLUGIN_GATE_BLOCKED,
  E_AI_EXTENSION_RULE_VIOLATION,
  E_AI_INVALID_PROMPT,
} from "./lib_bejson_AI_bejson_errors.js";

export const DEFAULT_AI_EXTENSION_RULES = [
  {
    ruleId: "rule-type-safety",
    ruleName: "Strict TypeScript Type Discipline",
    ruleType: "system_directive",
    active: true,
    directive: "Enforce strict TypeScript typing, avoiding 'any' casts and preserving interface contracts.",
  },
  {
    ruleId: "rule-security-path",
    ruleName: "Security & Path Containment",
    ruleType: "security_containment",
    active: true,
    directive: "Ensure generated paths stay contained within allowed root directories and strip all secret keys or env tokens.",
  },
  {
    ruleId: "rule-tri-color-style",
    ruleName: "Tri-Color Style Discipline",
    ruleType: "style_discipline",
    active: true,
    directive: "Adhere strictly to the Tri-Color Palette (#FFFFFF, #000000, #DE2626) with zero decorative fluff or unboxed pills.",
  },
  {
    ruleId: "rule-bejson-field-map",
    ruleName: "BEJSON Field Map Cache Mandate",
    ruleType: "validation_filter",
    active: true,
    directive: "Mandate Field Map Cache resolution (bejson_core_get_field_map) with zero index-based hardcoding.",
  },
];

export function createDefaultPluginGateConfig() {
  return {
    gateEnabled: true,
    passivelyAcceptRules: true,
    extensionName: "BEJSON System Rules Extension v1.0",
    strictMode: true,
    allowModelOverride: true,
    customRules: DEFAULT_AI_EXTENSION_RULES,
  };
}

export function bindExtensionRulesToPrompt(systemInstruction, userPrompt, config) {
  if (!config.gateEnabled && !config.passivelyAcceptRules) {
    return {
      finalSystemInstruction: systemInstruction,
      finalUserPrompt: userPrompt,
      boundRulesCount: 0,
      isGated: false,
    };
  }

  const activeRules = (config.customRules || []).filter((r) => r.active);
  if (activeRules.length === 0) {
    return {
      finalSystemInstruction: systemInstruction,
      finalUserPrompt: userPrompt,
      boundRulesCount: 0,
      isGated: config.gateEnabled,
    };
  }

  const ruleDirectivesBlock = activeRules
    .map((r, i) => `  ${i + 1}. [${r.ruleName}]: ${r.directive}`)
    .join("\n");

  const boundSystemInstruction = `${systemInstruction}\n\n### ACTIVE EXTENSION PLUGIN RULES (Gated: ${config.gateEnabled ? "TRUE" : "FALSE"} | Extension: ${config.extensionName}):\n${ruleDirectivesBlock}`;

  return {
    finalSystemInstruction: boundSystemInstruction,
    finalUserPrompt: userPrompt,
    boundRulesCount: activeRules.length,
    isGated: config.gateEnabled,
  };
}

export function evaluatePluginGate(config, prompt) {
  if (!prompt || !prompt.trim()) {
    return { allowed: false, errorCode: E_AI_INVALID_PROMPT, reason: "Prompt is empty." };
  }

  if (config.strictMode && config.gateEnabled) {
    const activeRules = (config.customRules || []).filter((r) => r.active);
    if (activeRules.length === 0) {
      return { allowed: false, errorCode: E_AI_PLUGIN_GATE_BLOCKED, reason: "Plugin gate is enabled in strict mode but no active extension rules are bound." };
    }
  }

  return { allowed: true };
}

export function buildPluginGateBEJSONSchema(config) {
  const now = new Date().toISOString().slice(0, 10);
  const rows = (config.customRules || []).map((rule, idx) => [
    rule.ruleId,
    idx + 1,
    rule.ruleName,
    rule.ruleType,
    rule.active,
    rule.directive,
  ]);

  return {
    Format: "BEJSON",
    Format_Version: "104a",
    Format_Creator: "Elton Boehnen",
    Records_Type: ["AIPluginRule"],
    Schema_Name: "AI Plugin Gate & Extension Rules Schema",
    Schema_Version: "1.0.0",
    Gate_Enabled: config.gateEnabled,
    Passively_Accept_Rules: config.passivelyAcceptRules,
    Extension_Name: config.extensionName,
    Strict_Mode: config.strictMode,
    Creation_Date: now,
    Fields: [
      { name: "rule_id", type: "string" },
      { name: "rule_order", type: "integer" },
      { name: "rule_name", type: "string" },
      { name: "rule_type", type: "string" },
      { name: "is_active", type: "boolean" },
      { name: "directive", type: "string" },
    ],
    Values: rows,
  };
}
