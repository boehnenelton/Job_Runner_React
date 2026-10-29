/**
 * Library:         lib_bejson_Runner_engine.js
 * Family:          Runner
 * Module Purpose:  Autonomous task execution engine, prompt synthesis assembler, unified diff generator, and BEJSON 104a Job document updater.
 * Architecture:    BEJSON 104a field map cached task state machine with multi-gate validation and atomic commit protocol.
 * Version:         3.1.6
 * Release_Version: 300
 * Date:            2026-09-27
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   5c81f092-7489-4bc2-965a-8bfe3f92d131
 */

/**
 * Returns positional field map using standard BEJSON 104a caching rules.
 */
export function bejson_core_get_field_map(doc) {
  if (!doc || !doc.Fields) return {};
  const fieldMap = {};
  doc.Fields.forEach((f, i) => {
    fieldMap[f.name] = i;
  });
  return fieldMap;
}

/**
 * Parses cell value to JSON if string-encoded, per 104a cell typing rules.
 */
export function cellFromJsonString(val) {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Extracts typed task items from a BEJSON 104a Job document using cached field maps.
 */
export function extractTasksFromJobDoc(jobDoc) {
  const fmap = bejson_core_get_field_map(jobDoc);
  const rows = jobDoc.Values || [];
  const tasks = [];

  for (const row of rows) {
    const rawCtx = fmap["task_context"] !== undefined ? row[fmap["task_context"]] : "[]";
    const rawRef = fmap["task_reference"] !== undefined ? row[fmap["task_reference"]] : "[]";

    tasks.push({
      taskId: String(row[fmap["task_id"]] ?? ""),
      taskOrder: Number(row[fmap["task_order"]] ?? 0),
      taskName: String(row[fmap["task_name"]] ?? ""),
      taskDescription: String(row[fmap["task_description"]] ?? ""),
      taskCompleted: Boolean(row[fmap["task_completed"]]),
      auditEnabled: Boolean(fmap["audit_enabled"] !== undefined ? row[fmap["audit_enabled"]] : false),
      auditPassed: Boolean(fmap["audit_passed"] !== undefined ? row[fmap["audit_passed"]] : false),
      auditFailReason: String(fmap["audit_fail_reason"] !== undefined ? row[fmap["audit_fail_reason"]] ?? "" : ""),
      taskContext: cellFromJsonString(rawCtx),
      taskReference: cellFromJsonString(rawRef),
      taskMandatory: Boolean(fmap["task_mandatory"] !== undefined ? row[fmap["task_mandatory"]] : false),
      testCmd: fmap["test_cmd"] !== undefined ? String(row[fmap["test_cmd"]] ?? "") : "",
    });
  }

  return tasks.sort((a, b) => a.taskOrder - b.taskOrder);
}

/**
 * Finds the current active pending task in a Job document.
 */
export function getActivePendingTask(jobDoc) {
  const tasks = extractTasksFromJobDoc(jobDoc);
  let activeTask = null;
  let lastOutput = "";

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task.taskCompleted) {
      activeTask = task;
      if (i > 0) {
        const prevTask = tasks[i - 1];
        const traces = jobDoc["Execution_Traces"] || {};
        lastOutput = traces[prevTask.taskId] || "";
      }
      break;
    }
  }

  const allCompleted = tasks.length > 0 && tasks.every((t) => t.taskCompleted);
  return { activeTask, lastOutput, allCompleted };
}

/**
 * Assembles the surgical AI prompt for the active task.
 */
export function assembleJobPrompt(jobDoc, activeTask, lastOutput, attachedFiles) {
  const systemInstruction =
    "You are an expert autonomous code architect. Apply surgical modifications to the target file to satisfy the active task instructions. Return strictly the complete, valid, updated code without markdown wrappers or conversational filler.";

  const parts = [];

  // 1. Job Goal
  const goal = String(jobDoc["Job_Goal"] || "").trim();
  parts.push(`### JOB GOAL\n${goal || "Perform requested updates."}`);

  // 2. Job Type / Job Subtype
  const jt = String(jobDoc["Job_Type"] || "").trim();
  const jst = String(jobDoc["Job_Subtype"] || "").trim();
  if (jt || jst) {
    parts.push(`### JOB TYPE\n${jt}${jst ? " / " + jst : ""}`);
  }

  // 3. Full Plan Scope (Contextualize_Plan)
  if (jobDoc["Contextualize_Plan"]) {
    const tasks = extractTasksFromJobDoc(jobDoc);
    const planLines = [];
    for (const t of tasks) {
      const mark = t.taskId === activeTask.taskId ? "  <-- ACTIVE" : "";
      const state = t.taskCompleted ? "done" : "pending";
      planLines.push(`${t.taskOrder}. ${t.taskName} [${state}]${mark}`);
      if (t.taskDescription && t.taskId !== activeTask.taskId) {
        planLines.push(`   ${t.taskDescription}`);
      }
    }
    parts.push(`### FULL PLAN\n${planLines.join("\n")}`);
  }

  // 4. Previous Task Output (Contextualize_Last)
  if (jobDoc["Contextualize_Last"] && lastOutput && String(lastOutput).trim()) {
    parts.push(`### PREVIOUS TASK OUTPUT\n${String(lastOutput).trim()}`);
  }

  // 5. Active Task
  parts.push(`### ACTIVE TASK ${activeTask.taskOrder}: ${activeTask.taskName}\n${activeTask.taskDescription}`.trim());

  // 6. Built-in Task Context Chunks
  const ctxParts = [];
  if (activeTask.taskContext && activeTask.taskContext.length > 0) {
    for (const ctx of activeTask.taskContext) {
      if (typeof ctx === "string") {
        ctxParts.push(ctx);
        continue;
      }
      if (ctx && typeof ctx === "object") {
        const ref = String(ctx.ref || "");
        if (ref) ctxParts.push(`#### [Context file: ${ref}]`);
        if (Array.isArray(ctx.chunks)) {
          for (const ch of ctx.chunks) {
            const body = String(ch.chunk_content || "").trim();
            if (body) ctxParts.push(body);
          }
        }
      }
    }
  }
  if (ctxParts.length > 0) {
    parts.push(`### TASK CONTEXT (study material; do not repeat it back)\n${ctxParts.join("\n\n")}`);
  }

  // 7. Task References
  if (activeTask.taskReference && activeTask.taskReference.length > 0) {
    const refs = activeTask.taskReference
      .map((r) => (typeof r === "object" && r !== null ? String(r.ref || "") : String(r || "")))
      .filter((r) => r && r !== "None");
    if (refs.length > 0) {
      parts.push(`### TASK REFERENCES (paths only)\n${refs.map((r) => `- ${r}`).join("\n")}`);
    }
  }

  // 8. User Attachments
  if (attachedFiles && attachedFiles.length > 0) {
    const activeContextFiles = attachedFiles.filter((f) => f.type === "context" && f.isChecked);
    const activeWorkFiles = attachedFiles.filter((f) => f.type === "work" && f.isChecked);

    if (activeContextFiles.length > 0) {
      const contextBlocks = activeContextFiles.map(
        (f) => `#### [Context File: ${f.name} | Path: ${f.path}]\n${f.content}`
      );
      parts.push(
        `### READ-ONLY CONTEXT STUDY MATERIAL:\n${contextBlocks.join("\n\n")}`
      );
    }

    if (activeWorkFiles.length > 0) {
      const workBlocks = activeWorkFiles.map(
        (f) => `#### [Work File: ${f.name} | Path: ${f.path}]\n${f.content}`
      );
      parts.push(
        `### WORK ATTACHMENTS (FILES FOR ACTIVE TASK EXECUTION):\n${workBlocks.join("\n\n")}`
      );
    }
  }

  // 9. Closing Instruction
  parts.push("### INSTRUCTION\nComplete the active task now and return only its deliverable.");

  return { systemInstruction, userPrompt: parts.join("\n\n") };
}

/**
 * Strips markdown code block fences.
 */
export function stripMarkdownFences(text) {
  let cleaned = String(text || "").trim();
  cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\r?\n/, "");
  cleaned = cleaned.replace(/\r?\n```\s*$/, "");
  return cleaned.trim();
}

/**
 * Pure JavaScript Unified Diff computation without dependencies.
 */
export function computeUnifiedDiff(originalText, newText, filename = "target") {
  const origLines = String(originalText || "").split(/\r?\n/);
  const newLines = String(newText || "").split(/\r?\n/);

  const m = origLines.length;
  const n = newLines.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (origLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const diffOps = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === newLines[j - 1]) {
      diffOps.unshift({ type: "equal", line: origLines[i - 1], origIdx: i, newIdx: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffOps.unshift({ type: "insert", line: newLines[j - 1], newIdx: j });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diffOps.unshift({ type: "delete", line: origLines[i - 1], origIdx: i });
      i--;
    }
  }

  if (diffOps.every((op) => op.type === "equal")) {
    return "(No differences detected)";
  }

  const header = `--- a/${filename}\n+++ b/${filename}\n`;
  const chunks = [header];

  let hunkOrigStart = 1;
  let hunkNewStart = 1;
  let hunkOrigCount = 0;
  let hunkNewCount = 0;
  const hunkLines = [];

  for (const op of diffOps) {
    if (op.type === "equal") {
      hunkLines.push(` ${op.line}`);
      hunkOrigCount++;
      hunkNewCount++;
    } else if (op.type === "delete") {
      hunkLines.push(`-${op.line}`);
      hunkOrigCount++;
    } else if (op.type === "insert") {
      hunkLines.push(`+${op.line}`);
      hunkNewCount++;
    }
  }

  chunks.push(`@@ -${hunkOrigStart},${hunkOrigCount} +${hunkNewStart},${hunkNewCount} @@\n` + hunkLines.join("\n"));
  return chunks.join("");
}

/**
 * Updates a BEJSON 104a Job document upon committing a task.
 */
export function commitTaskInJobDoc(jobDoc, taskId, traceSummary) {
  const clonedDoc = JSON.parse(JSON.stringify(jobDoc));
  const fmap = bejson_core_get_field_map(clonedDoc);
  const rows = clonedDoc.Values || [];

  let targetOrder = 0;
  for (const row of rows) {
    if (String(row[fmap["task_id"]]) === taskId) {
      row[fmap["task_completed"]] = true;
      if (fmap["audit_passed"] !== undefined) row[fmap["audit_passed"]] = true;
      if (fmap["audit_fail_reason"] !== undefined) row[fmap["audit_fail_reason"]] = "";
      targetOrder = Number(row[fmap["task_order"]]);
      break;
    }
  }

  const traces = clonedDoc["Execution_Traces"] || {};
  traces[taskId] = traceSummary || `Task ${targetOrder} committed successfully.`;
  clonedDoc["Execution_Traces"] = traces;

  const allDone = rows.length > 0 && rows.every((r) => Boolean(r[fmap["task_completed"]]));
  if (allDone) {
    clonedDoc["Job_Complete"] = true;
    clonedDoc["Completion_Date"] = new Date().toISOString().slice(0, 10);
  }

  return clonedDoc;
}

/**
 * Records an audit failure on a task without committing.
 */
export function recordTaskAuditFailure(jobDoc, taskId, failReason) {
  const clonedDoc = JSON.parse(JSON.stringify(jobDoc));
  const fmap = bejson_core_get_field_map(clonedDoc);
  const rows = clonedDoc.Values || [];

  for (const row of rows) {
    if (String(row[fmap["task_id"]]) === taskId) {
      if (fmap["audit_passed"] !== undefined) row[fmap["audit_passed"]] = false;
      if (fmap["audit_fail_reason"] !== undefined) row[fmap["audit_fail_reason"]] = failReason;
      break;
    }
  }

  return clonedDoc;
}
