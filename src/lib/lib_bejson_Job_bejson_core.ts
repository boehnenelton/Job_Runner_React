/**
 * Library:         lib_bejson_Job_bejson_core.ts
 * Family:          Job
 * Module Purpose:  Job Family Core Writer & Gate Engine. Gated by Job Schema validation, uses core library functions for actual writing.
 * Architecture:    BEJSON 104a Job Schema Specification & Execution Gate
 * Version:         100
 * Release_Version: 300
 * Date:            2026-10-29
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   9a21b490-d384-4f3b-88f3-3c5d63141300
 */

import { BEJSONDocument, BEJSONValue } from "./lib_bejson_Core_bejson_types";
import { 
  appendRecord, 
  updateRecord, 
  deleteRecord, 
  setFieldValue,
  serialize,
  parse
} from "./lib_bejson_Core_bejson_core";
import { bejson_core_get_field_map, bejson_core_get_field_index } from "./lib_bejson_Core_bejson_field_map";
import { validateJobSchema, JobValidationResult } from "./lib_bejson_Job_bejson_validators";
import { BEJSON_JOB_CODES, BEJSONJobError } from "./lib_bejson_Job_bejson_errors";

/**
 * Gate function: Validates that the document is valid BEJSON AND a valid Job Schema
 * before writing is permitted.
 */
export function bejson_job_enforce_write_gate(doc: BEJSONDocument): JobValidationResult {
  const result = validateJobSchema(doc);

  if (!result.isBejsonValid) {
    throw new BEJSONJobError(
      BEJSON_JOB_CODES.ERR_JOB_NOT_BEJSON,
      `Job Write Rejected: Document is not valid BEJSON. ${result.errors[0]?.message || ''}`
    );
  }

  if (!result.isJobSchemaValid) {
    throw new BEJSONJobError(
      BEJSON_JOB_CODES.ERR_JOB_WRITE_REJECTED,
      `Job Write Rejected: Document passed BEJSON structural checks but failed Job Schema validation. ${result.errors[0]?.message || ''}`
    );
  }

  return result;
}

/**
 * Adds a new task to the Job schema.
 * Gate: Validates document first.
 * Action: Uses core library function `appendRecord` for the actual writing.
 */
export function bejson_job_add_task(
  doc: BEJSONDocument,
  taskData: Record<string, any>
): BEJSONDocument {
  // 1. Enforce validation gate
  bejson_job_enforce_write_gate(doc);

  // 2. Map task fields to row values using field map cache
  const fieldMap = bejson_core_get_field_map(doc);
  const rowValues: BEJSONValue[] = new Array(doc.Fields.length).fill(null);

  for (const field of doc.Fields) {
    const idx = fieldMap[field.name];
    if (idx !== undefined) {
      if (field.name in taskData) {
        rowValues[idx] = taskData[field.name];
      } else {
        // Set default values for mandatory task fields
        if (field.name === "task_completed" || field.name === "audit_enabled" || field.name === "audit_passed" || field.name === "task_mandatory") {
          rowValues[idx] = false;
        } else if (field.name === "task_order") {
          rowValues[idx] = doc.Values.length + 1;
        } else if (field.type === "array") {
          rowValues[idx] = [];
        } else if (field.type === "string") {
          rowValues[idx] = "";
        }
      }
    }
  }

  // 3. Perform actual writing using Core Library function `appendRecord`
  return appendRecord(doc, rowValues);
}

/**
 * Updates an existing task by `task_id` in the Job schema.
 * Gate: Validates document first.
 * Action: Uses core library function `updateRecord` or `setFieldValue` for actual writing.
 */
export function bejson_job_update_task(
  doc: BEJSONDocument,
  taskId: string,
  updates: Record<string, any>
): BEJSONDocument {
  // 1. Enforce validation gate
  bejson_job_enforce_write_gate(doc);

  const taskIdIdx = bejson_core_get_field_index(doc, "task_id");
  if (taskIdIdx === -1) {
    throw new BEJSONJobError(
      BEJSON_JOB_CODES.ERR_JOB_MISSING_REQUIRED_FIELDS,
      "Job Schema missing task_id field."
    );
  }

  const recordIndex = doc.Values.findIndex((row) => row[taskIdIdx] === taskId);
  if (recordIndex === -1) {
    throw new BEJSONJobError(
      BEJSON_JOB_CODES.ERR_JOB_TASK_NOT_FOUND,
      `Task with task_id "${taskId}" not found in Job document.`
    );
  }

  let updatedDoc = doc;
  const fieldMap = bejson_core_get_field_map(doc);

  for (const [key, val] of Object.entries(updates)) {
    if (key in fieldMap) {
      // Perform field writing using Core Library function `setFieldValue`
      updatedDoc = setFieldValue(updatedDoc, recordIndex, key, val);
    }
  }

  return updatedDoc;
}

/**
 * Toggles or sets task completion state by `task_id`.
 * Gate: Validates document first.
 * Action: Uses core library function `setFieldValue`.
 */
export function bejson_job_set_task_completed(
  doc: BEJSONDocument,
  taskId: string,
  completed: boolean
): BEJSONDocument {
  return bejson_job_update_task(doc, taskId, { task_completed: completed });
}

/**
 * Deletes a task by `task_id`.
 * Gate: Validates document first.
 * Action: Uses core library function `deleteRecord`.
 */
export function bejson_job_delete_task(
  doc: BEJSONDocument,
  taskId: string
): BEJSONDocument {
  // 1. Enforce validation gate
  bejson_job_enforce_write_gate(doc);

  const taskIdIdx = bejson_core_get_field_index(doc, "task_id");
  if (taskIdIdx === -1) {
    throw new BEJSONJobError(
      BEJSON_JOB_CODES.ERR_JOB_MISSING_REQUIRED_FIELDS,
      "Job Schema missing task_id field."
    );
  }

  const recordIndex = doc.Values.findIndex((row) => row[taskIdIdx] === taskId);
  if (recordIndex === -1) {
    throw new BEJSONJobError(
      BEJSON_JOB_CODES.ERR_JOB_TASK_NOT_FOUND,
      `Task with task_id "${taskId}" not found.`
    );
  }

  // Perform record deletion using Core Library function `deleteRecord`
  return deleteRecord(doc, recordIndex);
}

/**
 * Atomic commit wrapper for multiple job mutations.
 * Gate: Validates schema before applying any mutation.
 */
export function bejson_job_atomic_commit(
  doc: BEJSONDocument,
  mutations: Array<(d: BEJSONDocument) => BEJSONDocument>
): BEJSONDocument {
  bejson_job_enforce_write_gate(doc);

  let currentDoc = doc;
  for (const mut of mutations) {
    currentDoc = mut(currentDoc);
    // Re-verify after mutation
    bejson_job_enforce_write_gate(currentDoc);
  }

  return currentDoc;
}

export { serialize as bejson_job_serialize, parse as bejson_job_parse };
