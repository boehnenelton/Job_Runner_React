/**
 * Library:         lib_bejson_Job_bejson_validators.ts
 * Family:          Job
 * Module Purpose:  Validator for the BEJSON Job Family. Sources core validator first, then validates Job Schema compliance.
 * Architecture:    BEJSON 104a Job Schema Specification & Execution Gate
 * Version:         100
 * Release_Version: 300
 * Date:            2026-10-29
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   8f12b390-c284-4e3b-99f3-2c4d53141200
 */

import { validateDocument } from "./lib_bejson_Core_bejson_validators";
import { BEJSONDocument, ValidationResult, ValidationError } from "./lib_bejson_Core_bejson_types";
import { bejson_core_get_field_map, FieldMap } from "./lib_bejson_Core_bejson_field_map";
import { BEJSON_JOB_CODES } from "./lib_bejson_Job_bejson_errors";

export interface JobValidationResult extends ValidationResult {
  isBejsonValid: boolean;
  isJobSchemaValid: boolean;
  field_map?: FieldMap;
}

export const REQUIRED_JOB_FIELDS = [
  "task_id",
  "task_order",
  "task_name",
  "task_description",
  "task_completed"
] as const;

/**
 * Validates a document against core BEJSON rules first.
 * If valid BEJSON, then validates that the document satisfies the Job Schema specification.
 */
export function validateJobSchema(doc: unknown): JobValidationResult {
  // Step 1: Source Core BEJSON Validator
  const coreResult = validateDocument(doc);
  
  const result: JobValidationResult = {
    valid: false,
    isBejsonValid: coreResult.valid,
    isJobSchemaValid: false,
    errors: [...coreResult.errors],
    warnings: [...coreResult.warnings],
  };

  // If core BEJSON validation fails, reject immediately
  if (!coreResult.valid) {
    return result;
  }

  const bej = doc as BEJSONDocument;

  // Step 2: Validate Job Schema compliance
  const errors: ValidationError[] = [];

  // 2a. Verify Schema Name / Records Type indicator if header present
  const rawDoc = doc as Record<string, unknown>;
  const schemaName = typeof rawDoc["Schema_Name"] === "string" ? (rawDoc["Schema_Name"] as string) : "";
  const recordsType = Array.isArray(bej.Records_Type) ? bej.Records_Type : [];

  const isJobSchemaNamed = 
    schemaName.toLowerCase().includes("job") ||
    recordsType.some(rt => rt.toLowerCase().includes("job") || rt.toLowerCase().includes("task"));

  // 2b. Check required field map presence
  const fieldMap = bejson_core_get_field_map(bej);
  result.field_map = fieldMap;

  const missingFields: string[] = [];
  for (const reqField of REQUIRED_JOB_FIELDS) {
    if (!(reqField in fieldMap)) {
      missingFields.push(reqField);
    }
  }

  if (missingFields.length > 0) {
    errors.push({
      code: BEJSON_JOB_CODES.ERR_JOB_MISSING_REQUIRED_FIELDS,
      message: `Job Schema validation failed: Missing required fields: ${missingFields.join(", ")}`,
      field: "Fields"
    });
  }

  if (!isJobSchemaNamed && missingFields.length > 0) {
    errors.push({
      code: BEJSON_JOB_CODES.ERR_JOB_INVALID_SCHEMA,
      message: "Document is valid BEJSON but lacks Job Schema declaration and required task fields.",
      field: "Schema_Name"
    });
  }

  if (errors.length === 0) {
    result.isJobSchemaValid = true;
    result.valid = true;
  } else {
    result.errors.push(...errors);
    result.valid = false;
  }

  return result;
}

export function isJobSchemaValid(doc: unknown): boolean {
  return validateJobSchema(doc).valid;
}

export function assertValidJobSchema(doc: unknown): void {
  const result = validateJobSchema(doc);
  if (!result.isBejsonValid) {
    throw new Error(`Core BEJSON Validation Failed: ${result.errors[0]?.message || 'Invalid BEJSON'}`);
  }
  if (!result.isJobSchemaValid) {
    throw new Error(`Job Schema Validation Failed: ${result.errors[0]?.message || 'Invalid Job Schema'}`);
  }
}
