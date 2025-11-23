// @ts-check

(function () {
  // Get VSCode API
  const vscode = acquireVsCodeApi();

  // State
  let currentData = {
    workflows: [],
    tools: [],
    approvals: [],
  };

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    requestRefresh();
  });

  // Handle messages from extension
  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
      case 'dashboardUpdate':
        currentData = message.payload;
        renderDashboard();
        break;

      case 'chatUpdate':
        handleChatUpdate(message.payload);
        break;
    }
  });

  function setupEventListeners() {
    document.getElementById('refresh-btn')?.addEventListener('click', requestRefresh);
    document.getElementById('clear-state-btn')?.addEventListener('click', clearState);
    document.getElementById('view-logs-btn')?.addEventListener('click', viewLogs);
  }

  function renderDashboard() {
    renderWorkflows();
    renderApprovals();
    renderTools();
  }

  function renderWorkflows() {
    const container = document.getElementById('workflow-list');
    if (!container) return;

    if (currentData.workflows.length === 0) {
      container.innerHTML = '<div class="empty-state">No active workflows</div>';
      return;
    }

    container.innerHTML = currentData.workflows
      .map(
        (workflow) => `
        <div class="workflow-item" data-id="${workflow.id}">
          <div class="workflow-header">
            <span class="workflow-name">${escapeHtml(workflow.name)}</span>
            <span class="workflow-status status-${workflow.status}">${workflow.status}</span>
          </div>
          <div class="workflow-details">
            <div class="detail-item">
              <span class="label">Iterations:</span>
              <span class="value">${workflow.iterations}</span>
            </div>
            <div class="detail-item">
              <span class="label">Duration:</span>
              <span class="value">${formatDuration(workflow.startTime, workflow.endTime)}</span>
            </div>
            ${workflow.currentPhase ? `
              <div class="detail-item">
                <span class="label">Phase:</span>
                <span class="value">${workflow.currentPhase.name} (${workflow.currentPhase.status})</span>
              </div>
            ` : ''}
          </div>
          ${workflow.status !== 'completed' && workflow.status !== 'failed' ? `
            <button class="button small cancel-btn" data-workflow-id="${workflow.id}">Cancel</button>
          ` : ''}
        </div>
      `
      )
      .join('');

    // Add event listeners for cancel buttons
    container.querySelectorAll('.cancel-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const workflowId = e.target.getAttribute('data-workflow-id');
        cancelWorkflow(workflowId);
      });
    });
  }

  function renderApprovals() {
    const container = document.getElementById('approval-list');
    if (!container) return;

    if (currentData.approvals.length === 0) {
      container.innerHTML = '<div class="empty-state">No pending approvals</div>';
      return;
    }

    container.innerHTML = currentData.approvals
      .filter((approval) => approval.status === 'pending')
      .map(
        (approval) => `
        <div class="approval-item" data-id="${approval.id}">
          <div class="approval-header">
            <span class="approval-type">${escapeHtml(approval.action.type)}</span>
            <span class="approval-impact impact-${approval.action.impact}">${approval.action.impact}</span>
          </div>
          <div class="approval-description">
            ${escapeHtml(approval.action.description)}
          </div>
          <div class="approval-details">
            <div class="detail-item">
              <span class="label">Reversible:</span>
              <span class="value">${approval.action.reversible ? 'Yes' : 'No'}</span>
            </div>
            <div class="detail-item">
              <span class="label">Time:</span>
              <span class="value">${formatTimestamp(approval.timestamp)}</span>
            </div>
          </div>
          <div class="approval-actions">
            <textarea class="comment-input" placeholder="Optional comment..."></textarea>
            <button class="button approve-btn" data-approval-id="${approval.id}">Approve</button>
            <button class="button secondary deny-btn" data-approval-id="${approval.id}">Deny</button>
          </div>
        </div>
      `
      )
      .join('');

    // Add event listeners
    container.querySelectorAll('.approve-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const approvalId = e.target.getAttribute('data-approval-id');
        const comment = e.target.parentElement?.querySelector('.comment-input')?.value || '';
        approveAction(approvalId, comment);
      });
    });

    container.querySelectorAll('.deny-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const approvalId = e.target.getAttribute('data-approval-id');
        const comment = e.target.parentElement?.querySelector('.comment-input')?.value || '';
        denyAction(approvalId, comment);
      });
    });
  }

  function renderTools() {
    const container = document.getElementById('tool-list');
    if (!container) return;

    if (currentData.tools.length === 0) {
      container.innerHTML = '<div class="empty-state">No tools registered</div>';
      return;
    }

    container.innerHTML = currentData.tools
      .map(
        (tool) => `
        <div class="tool-item">
          <div class="tool-header">
            <span class="tool-name">${escapeHtml(tool.name)}</span>
            <span class="tool-id">${escapeHtml(tool.id)}</span>
          </div>
          <div class="tool-description">${escapeHtml(tool.description)}</div>
          <div class="tool-stats">
            <span class="stat">Executions: ${tool.executionCount}</span>
            ${tool.lastExecuted ? `
              <span class="stat">Last used: ${formatTimestamp(tool.lastExecuted)}</span>
            ` : ''}
          </div>
        </div>
      `
      )
      .join('');
  }

  // Actions
  function requestRefresh() {
    vscode.postMessage({ type: 'requestRefresh' });
  }

  function clearState() {
    vscode.postMessage({ type: 'clearState' });
  }

  function viewLogs() {
    vscode.postMessage({ type: 'viewLogs' });
  }

  function cancelWorkflow(workflowId) {
    vscode.postMessage({
      type: 'cancelWorkflow',
      workflowId: workflowId,
    });
  }

  function approveAction(approvalId, comment) {
    vscode.postMessage({
      type: 'approveAction',
      requestId: approvalId,
      comment: comment,
    });
  }

  function denyAction(approvalId, comment) {
    vscode.postMessage({
      type: 'denyAction',
      requestId: approvalId,
      comment: comment,
    });
  }

  function handleChatUpdate(payload) {
    // Handle updates from chat
    console.log('Chat update:', payload);
  }

  // Utilities
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDuration(startTime, endTime) {
    if (!endTime) {
      const duration = Date.now() - startTime;
      return `${Math.floor(duration / 1000)}s`;
    }
    const duration = endTime - startTime;
    return `${Math.floor(duration / 1000)}s`;
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
})();
