/**
 * Library:         lib_bejson_AI_bejson_errors.ts
 * Family:          AI
 * Module Purpose:  Centralized error code registry for AI provider interfaces, model dispatch, and extension plugin rule gates.
 * Architecture:    BEJSON 104a Family Error Code Registry allocating integer range 200 - 229.
 * Version:         3.1.14
 * Release_Version: 300
 * Date:            2026-10-28
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   e8a719c2-4b21-4f81-a982-8411b01c3812
 */

export const E_AI_PROVIDER_UNAVAILABLE = 200;
export const E_AI_INVALID_PROMPT = 201;
export const E_AI_PLUGIN_GATE_BLOCKED = 202;
export const E_AI_EXTENSION_RULE_VIOLATION = 203;
export const E_AI_CONTEXT_BUBBLE_OVERFLOW = 204;
export const E_AI_MODEL_FALLBACK_FAILED = 205;
export const E_AI_KEY_SLOT_EMPTY = 206;
export const E_AI_STRUCTURED_PARSE_FAILED = 207;

export const AI_ERROR_MESSAGES: Record<number, string> = {
  [E_AI_PROVIDER_UNAVAILABLE]: "AI model provider endpoint is unavailable or unreachable.",
  [E_AI_INVALID_PROMPT]: "Transmitted turn prompt or system instruction is empty or invalid.",
  [E_AI_PLUGIN_GATE_BLOCKED]: "AI execution blocked: Plugin rule gate is active and evaluated to False.",
  [E_AI_EXTENSION_RULE_VIOLATION]: "AI prompt or candidate output violated an active extension rule directive.",
  [E_AI_CONTEXT_BUBBLE_OVERFLOW]: "Attached context files or prompt history exceeded model token window capacity.",
  [E_AI_MODEL_FALLBACK_FAILED]: "Cascading model fallback failed across all configured model candidates.",
  [E_AI_KEY_SLOT_EMPTY]: "Selected API key slot in round-robin store is unpopulated or inactive.",
  [E_AI_STRUCTURED_PARSE_FAILED]: "Model response failed structured BEJSON 104a JSON parsing and validation.",
};

export function getAIErrorMessage(code: number): string {
  return AI_ERROR_MESSAGES[code] || `Unknown AI Family Error Code (${code})`;
}
