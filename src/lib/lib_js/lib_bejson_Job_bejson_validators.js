/**
 * Library:         lib_bejson_Job_bejson_validators.js
 * Family:          Job
 * Module Purpose:  Validator for the BEJSON Job Family (Vanilla JS Mirror). Sources core validator first, then validates Job Schema compliance.
 * Architecture:    BEJSON 104a Job Schema Specification & Execution Gate
 * Version:         100
 * Release_Version: 300
 * Date:            2026-10-29
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   8f12b390-c284-4e3b-99f3-2c4d53141201
 */

import { validateDocument } from "../lib_bejson_Core_bejson_validators.js";
import { bejson_core_get_field_map } from "../lib_bejson_Core_bejson_field_map.js";
import { BEJSON_JOB_CODES } from "./lib_bejson_Job_bejson_errors.js";

export const REQUIRED_JOB_FIELDS = Object.freeze([
  "task_id",
  "task_order",
  "task_name",
  "task_description",
  "task_completed"
]);

/**
 * Validates a document against core BEJSON rules first.
 * If valid BEJSON, then validates that the document satisfies the Job Schema specification.
 */
export function validateJobSchema(doc) {
  // Step 1: Source Core BEJSON Validator
  const coreResult = validateDocument(doc);
  
  const result = {
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

  // Step 2: Validate Job Schema compliance
  const errors = [];
  const schemaName = typeof doc?.Schema_Name === "string" ? doc.Schema_Name : "";
  const recordsType = Array.isArray(doc?.Records_Type) ? doc.Records_Type : [];

  const isJobSchemaNamed = 
    schemaName.toLowerCase().includes("job") ||
    recordsType.some(rt => String(rt).toLowerCase().includes("job") || String(rt).toLowerCase().includes("task"));

  const fieldMap = bejson_core_get_field_map(doc);
  result.field_map = fieldMap;

  const missingFields = [];
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

export function isJobSchemaValid(doc) {
  return validateJobSchema(doc).valid;
}

export function assertValidJobSchema(doc) {
  const result = validateJobSchema(doc);
  if (!result.isBejsonValid) {
    throw new Error(`Core BEJSON Validation Failed: ${result.errors[0]?.message || 'Invalid BEJSON'}`);
  }
  if (!result.isJobSchemaValid) {
    throw new Error(`Job Schema Validation Failed: ${result.errors[0]?.message || 'Invalid Job Schema'}`);
  }
}
