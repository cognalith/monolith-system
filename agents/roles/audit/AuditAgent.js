/**
 * MONOLITH OS - Audit Agent
 * Phase 11: Event Log & Memory Implementation
 *
 * Responsible for auditing completed tasks to ensure quality,
 * track drift, and capture learnings for continuous improvement.
 *
 * Capabilities:
 * - Grade completed tasks on accuracy, completeness, quality, efficiency
 * - Detect drift from original request
 * - Calculate time variance (estimated vs actual)
 * - Save audits to monolith_task_audits table
 * - Send successful learnings to MONA for knowledge capture
 */

import LLMRouter from '../../core/LLMRouter.js';
import { createClient } from '@supabase/supabase-js';

// Audit grading system prompt
const AUDIT_SYSTEM_PROMPT = `You are an Audit Agent for MONOLITH OS, responsible for grading completed tasks.

Your job is to evaluate task outputs against their original requests and provide objective scores.

## Grading Criteria (0-100 scale):

1. **ACCURACY** - Did the output address the actual request?
   - 90-100: Perfectly addressed the request
   - 70-89: Mostly addressed with minor gaps
   - 50-69: Partially addressed, significant gaps
   - 0-49: Failed to address the request

2. **COMPLETENESS** - Were all aspects of the request covered?
   - 90-100: All aspects thoroughly covered
   - 70-89: Most aspects covered
   - 50-69: Some aspects missing
   - 0-49: Major gaps in coverage

3. **QUALITY** - Is the output well-structured and professional?
   - 90-100: Excellent quality, ready for use
   - 70-89: Good quality, minor improvements possible
   - 50-69: Acceptable but needs refinement
   - 0-49: Poor quality, needs rework

4. **EFFICIENCY** - Was the output produced appropriately given the scope?
   - 90-100: Efficient, appropriate scope
   - 70-89: Slightly over/under scoped
   - 50-69: Noticeable inefficiency
   - 0-49: Significantly inefficient

## Drift Detection

Drift occurs when the output substantially deviates from what was requested.
- **None**: Output matches request intent
- **Minor**: Small interpretations that don't affect outcome
- **Moderate**: Noticeable deviations that partially change outcome
- **Severe**: Output doesn't align with original request

## Output Format

Respond with JSON only:
{
  "accuracy": <0-100>,
  "completeness": <0-100>,
  "quality": <0-100>,
  "efficiency": <0-100>,
  "drift_detected": <true|false>,
  "drift_severity": <"none"|"minor"|"moderate"|"severe">,
  "drift_description": "<description if drift detected>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "learning_value": <true|false>,
  "learning_summary": "<brief summary if learning_value is true>"
}`;

class AuditAgent {
  constructor(config = {}) {
    // Initialize LLM router
    this.llm = config.llmRouter || new LLMRouter();

    // Initialize Supabase client
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('[AUDIT-AGENT] Supabase client initialized');
    } else {
      this.supabase = null;
      console.warn('[AUDIT-AGENT] Supabase not configured - audits will be logged only');
    }

    // Audit thresholds
    this.learningThreshold = config.learningThreshold || 80;
    this.driftAlertThreshold = config.driftAlertThreshold || 'moderate';

    console.log('[AUDIT-AGENT] Audit Agent initialized');
  }

  /**
   * Audit a completed task
   * @param {Object} task - The completed task object
   * @param {Object} result - The task execution result
   * @returns {Object} The audit result
   */
  async auditCompletedTask(task, result) {
    console.log(`[AUDIT-AGENT] Auditing task ${task.id} completed by ${task.assigned_agent}`);

    try {
      // 1. Extract audit inputs
      const originalRequest = task.content || task.title || 'No content available';
      const actualOutput = this.extractOutput(result);
      const estimatedHours = task.estimated_hours || 1;
      const actualHours = this.calculateActualHours(task);

      // 2. Calculate time variance
      const timeVariance = estimatedHours > 0
        ? ((actualHours - estimatedHours) / estimatedHours) * 100
        : 0;

      // 3. Use LLM to grade the task
      const gradeResponse = await this.gradeTask(originalRequest, actualOutput);

      // 4. Parse grades
      const grades = this.parseGrades(gradeResponse);

      // 5. Calculate overall score
      const overallScore = (
        grades.accuracy +
        grades.completeness +
        grades.quality +
        grades.efficiency
      ) / 4;

      // 6. Build audit record
      const auditRecord = {
        task_id: task.id,
        audited_agent: task.assigned_agent,
        original_request: originalRequest.substring(0, 2000), // Limit size
        actual_output_summary: actualOutput.substring(0, 500),
        estimated_hours: estimatedHours,
        actual_hours: actualHours,
        time_variance_percent: Math.round(timeVariance * 100) / 100,
        accuracy_score: grades.accuracy,
        completeness_score: grades.completeness,
        quality_score: grades.quality,
        efficiency_score: grades.efficiency,
        overall_score: Math.round(overallScore * 100) / 100,
        drift_detected: grades.drift_detected,
        drift_severity: grades.drift_severity,
        drift_description: grades.drift_description,
        strengths: grades.strengths,
        improvements: grades.improvements,
        learning_value: grades.learning_value,
        learning_summary: grades.learning_summary,
        audited_at: new Date().toISOString(),
      };

      // 7. Save audit to database
      if (this.supabase) {
        await this.saveAudit(auditRecord);
      }

      // 8. Log audit result
      console.log(`[AUDIT-AGENT] Task ${task.id} audit complete:`, {
        overall: auditRecord.overall_score,
        drift: auditRecord.drift_detected ? auditRecord.drift_severity : 'none',
        timeVariance: `${auditRecord.time_variance_percent}%`,
      });

      // 9. Send learning to MONA if valuable
      if (grades.learning_value && grades.accuracy >= this.learningThreshold && !grades.drift_detected) {
        await this.sendLearningToMona(task, result, grades);
      }

      // 10. Alert on significant drift
      if (grades.drift_detected && this.shouldAlertDrift(grades.drift_severity)) {
        await this.alertDrift(task, grades);
      }

      return {
        success: true,
        audit: auditRecord,
      };
    } catch (error) {
      console.error(`[AUDIT-AGENT] Error auditing task ${task.id}:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Extract output from task result
   */
  extractOutput(result) {
    if (!result) return 'No output available';

    // Handle various result structures
    if (typeof result === 'string') {
      return result;
    }

    if (result.outputs?.response) {
      return result.outputs.response;
    }

    if (result.content) {
      return result.content;
    }

    if (result.response) {
      return result.response;
    }

    if (result.outputs) {
      return JSON.stringify(result.outputs, null, 2);
    }

    return JSON.stringify(result, null, 2);
  }

  /**
   * Calculate actual hours from task timestamps
   */
  calculateActualHours(task) {
    if (task.started_at && task.completed_at) {
      const startTime = new Date(task.started_at);
      const endTime = new Date(task.completed_at);
      const diffMs = endTime - startTime;
      return diffMs / (1000 * 60 * 60); // Convert to hours
    }

    // Fallback to estimated if no timestamps
    return task.estimated_hours || 1;
  }

  /**
   * Use LLM to grade the task
   */
  async gradeTask(originalRequest, actualOutput) {
    const gradePrompt = `Grade this completed task.

## Original Request:
${originalRequest}

## Actual Output:
${actualOutput}

Evaluate the output against the request and provide grades following the criteria in your instructions.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: AUDIT_SYSTEM_PROMPT,
      userMessage: gradePrompt,
      temperature: 0.3, // Lower temperature for consistent grading
    });

    return response.content;
  }

  /**
   * Parse grades from LLM response
   */
  parseGrades(gradeResponse) {
    const defaultGrades = {
      accuracy: 70,
      completeness: 70,
      quality: 70,
      efficiency: 70,
      drift_detected: false,
      drift_severity: 'none',
      drift_description: null,
      strengths: [],
      improvements: [],
      learning_value: false,
      learning_summary: null,
    };

    try {
      // Try to extract JSON from response
      const jsonMatch = gradeResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...defaultGrades,
          ...parsed,
        };
      }
    } catch (error) {
      console.warn('[AUDIT-AGENT] Failed to parse grade response, using defaults:', error.message);
    }

    return defaultGrades;
  }

  /**
   * Save audit record to database
   */
  async saveAudit(auditRecord) {
    if (!this.supabase) {
      console.log('[AUDIT-AGENT] Audit record (no DB):', auditRecord);
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('monolith_task_audits')
        .insert([{
          task_id: auditRecord.task_id,
          audited_agent: auditRecord.audited_agent,
          original_request: auditRecord.original_request,
          actual_output_summary: auditRecord.actual_output_summary,
          estimated_hours: auditRecord.estimated_hours,
          actual_hours: auditRecord.actual_hours,
          time_variance_percent: auditRecord.time_variance_percent,
          accuracy_score: auditRecord.accuracy_score,
          completeness_score: auditRecord.completeness_score,
          quality_score: auditRecord.quality_score,
          efficiency_score: auditRecord.efficiency_score,
          overall_score: auditRecord.overall_score,
          drift_detected: auditRecord.drift_detected,
          drift_severity: auditRecord.drift_severity,
          drift_description: auditRecord.drift_description,
          audit_notes: JSON.stringify({
            strengths: auditRecord.strengths,
            improvements: auditRecord.improvements,
            learning_value: auditRecord.learning_value,
            learning_summary: auditRecord.learning_summary,
          }),
        }])
        .select();

      if (error) {
        console.error('[AUDIT-AGENT] Failed to save audit:', error.message);
        return null;
      }

      console.log(`[AUDIT-AGENT] Audit saved for task ${auditRecord.task_id}`);
      return data[0];
    } catch (error) {
      console.error('[AUDIT-AGENT] Database error:', error.message);
      return null;
    }
  }

  /**
   * Check if drift severity warrants an alert
   */
  shouldAlertDrift(severity) {
    const severityLevels = ['none', 'minor', 'moderate', 'severe'];
    const thresholdIndex = severityLevels.indexOf(this.driftAlertThreshold);
    const severityIndex = severityLevels.indexOf(severity);
    return severityIndex >= thresholdIndex;
  }

  /**
   * Alert on significant drift
   */
  async alertDrift(task, grades) {
    console.warn(`[AUDIT-AGENT] DRIFT ALERT for task ${task.id}:`, {
      agent: task.assigned_agent,
      severity: grades.drift_severity,
      description: grades.drift_description,
    });

    // Log drift event to database if available
    if (this.supabase) {
      try {
        await this.supabase
          .from('monolith_task_state_log')
          .insert([{
            task_id: task.id,
            change_type: 'drift_detected',
            old_value: 'expected',
            new_value: grades.drift_severity,
            change_reason: grades.drift_description,
            changed_by_agent: 'audit',
            changed_by_type: 'system',
          }]);
      } catch (error) {
        console.warn('[AUDIT-AGENT] Failed to log drift event:', error.message);
      }
    }
  }

  /**
   * Send valuable learning to MONA for knowledge capture
   */
  async sendLearningToMona(task, result, grades) {
    console.log(`[AUDIT-AGENT] Capturing learning from task ${task.id} for MONA`);

    // Build learning record
    const learning = {
      source_task_id: task.id,
      source_agent: task.assigned_agent,
      learning_type: 'task_completion',
      context: task.content,
      outcome: this.extractOutput(result).substring(0, 1000),
      quality_score: grades.accuracy,
      summary: grades.learning_summary,
      captured_at: new Date().toISOString(),
    };

    // Save to agent knowledge table if available
    if (this.supabase) {
      try {
        await this.supabase
          .from('monolith_agent_knowledge')
          .insert([{
            agent_role: task.assigned_agent,
            knowledge_type: 'task_learning',
            content: JSON.stringify(learning),
            source_task_id: task.id,
            confidence_score: grades.accuracy / 100,
            is_verified: true,
          }]);

        console.log(`[AUDIT-AGENT] Learning captured for ${task.assigned_agent}`);
      } catch (error) {
        console.warn('[AUDIT-AGENT] Failed to save learning:', error.message);
      }
    }

    return learning;
  }

  /**
   * Get audit statistics for an agent
   */
  async getAgentAuditStats(agentRole, days = 30) {
    if (!this.supabase) {
      return null;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      const { data, error } = await this.supabase
        .from('monolith_task_audits')
        .select('*')
        .eq('audited_agent', agentRole)
        .gte('audited_at', cutoffDate.toISOString());

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          agent: agentRole,
          total_audits: 0,
          avg_overall_score: null,
          drift_count: 0,
          avg_time_variance: null,
        };
      }

      const driftCount = data.filter(a => a.drift_detected).length;
      const avgScore = data.reduce((sum, a) => sum + (a.overall_score || 0), 0) / data.length;
      const avgVariance = data.reduce((sum, a) => sum + (a.time_variance_percent || 0), 0) / data.length;

      return {
        agent: agentRole,
        total_audits: data.length,
        avg_overall_score: Math.round(avgScore * 100) / 100,
        drift_count: driftCount,
        drift_rate: Math.round((driftCount / data.length) * 100) / 100,
        avg_time_variance: Math.round(avgVariance * 100) / 100,
      };
    } catch (error) {
      console.error('[AUDIT-AGENT] Failed to get audit stats:', error.message);
      return null;
    }
  }
}

export default AuditAgent;
export { AUDIT_SYSTEM_PROMPT };
