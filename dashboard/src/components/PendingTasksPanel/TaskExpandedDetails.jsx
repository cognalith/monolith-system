/**
 * TaskExpandedDetails Component
 * Renders expanded details for a task including steps, dependencies, and action buttons.
 * Part of the Task Completion feature for MONOLITH OS dashboard.
 */
import './PendingTasksPanel.css';

const TaskExpandedDetails = ({
  task,
  steps,
  stepsLoading,
  onComplete,
  onSendToAgent,
  actionLoading,
  actionFeedback,
}) => {
  const hasSteps = steps && steps.length > 0;
  const hasBlockedBy = task.blockedBy && task.blockedBy.length > 0;
  const hasBlocks = task.blocks && task.blocks.length > 0;
  const hasDependencies = hasBlockedBy || hasBlocks;

  return (
    <div className="task-expanded-details">
      {/* Steps Section */}
      <div className="task-steps">
        <div className="task-steps-header">Steps</div>
        {stepsLoading ? (
          <div className="task-steps-loading">
            <span className="loading-spinner-small"></span>
            <span>Loading steps...</span>
          </div>
        ) : hasSteps ? (
          <div className="task-steps-list">
            {steps.map((step, index) => (
              <div key={step.id || index} className="task-step">
                <input
                  type="checkbox"
                  className="task-step-checkbox"
                  checked={step.completed || false}
                  readOnly
                />
                <span className={`task-step-text ${step.completed ? 'completed' : ''}`}>
                  {step.content || step.description || `Step ${index + 1}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="task-steps-empty">No steps defined for this task</div>
        )}
      </div>

      {/* Dependencies Section */}
      {hasDependencies && (
        <div className="task-dependencies">
          {hasBlockedBy && (
            <div className="dependency-group">
              <span className="dependency-label">Blocked by:</span>
              <span className="dependency-list">
                {task.blockedBy.map((dep, i) => (
                  <span key={dep} className="dependency-item blocked-by">
                    {dep}
                    {i < task.blockedBy.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </span>
            </div>
          )}
          {hasBlocks && (
            <div className="dependency-group">
              <span className="dependency-label">Blocks:</span>
              <span className="dependency-list">
                {task.blocks.map((dep, i) => (
                  <span key={dep} className="dependency-item blocks">
                    {dep}
                    {i < task.blocks.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="task-actions">
        <button
          className="btn-complete"
          onClick={() => onComplete(task.id)}
          disabled={actionLoading !== null}
        >
          {actionLoading === 'complete' ? (
            <>
              <span className="loading-spinner-small"></span>
              <span>Completing...</span>
            </>
          ) : (
            'Complete Task'
          )}
        </button>
        <button
          className="btn-agent"
          onClick={() => onSendToAgent(task.id)}
          disabled={actionLoading !== null}
        >
          {actionLoading === 'agent' ? (
            <>
              <span className="loading-spinner-small"></span>
              <span>Sending...</span>
            </>
          ) : (
            'Send to Agent'
          )}
        </button>
      </div>

      {/* Action Feedback */}
      {actionFeedback && (
        <div className={`action-feedback ${actionFeedback.type}`}>
          {actionFeedback.message}
        </div>
      )}
    </div>
  );
};

export default TaskExpandedDetails;
