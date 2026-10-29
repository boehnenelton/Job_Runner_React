/**
 * Library:         lib_bejson_Job_bejson_errors.ts
 * Family:          Job
 * Module Purpose:  Centralized error code registry and exception class for the BEJSON Job Family.
 * Architecture:    BEJSON 104a Job Schema Specification & Execution Gate
 * Version:         100
 * Release_Version: 300
 * Date:            2026-10-29
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   7f31a290-b184-4e2b-98f2-1b3c43141100
 */

export const BEJSON_JOB_CODES = {
  ERR_JOB_NOT_BEJSON: 400,
  ERR_JOB_INVALID_SCHEMA: 401,
  ERR_JOB_MISSING_REQUIRED_FIELDS: 402,
  ERR_JOB_UNSUPPORTED_VERSION: 403,
  ERR_JOB_WRITE_REJECTED: 404,
  ERR_JOB_TASK_NOT_FOUND: 405,
  ERR_JOB_GATE_VALIDATION_FAILED: 406,
} as const;

export class BEJSONJobError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "BEJSONJobError";
    this.code = code;
  }
}
