// MCQMCP Client - Connects to the MCQ MCP Server for learning assessment
// Uses local API proxy at /api/mcq which connects to https://mcqmcp.onrender.com

/**
 * Call an MCP tool via the local API proxy
 * @param {string} toolName - One of: mcq_generate, mcq_record, mcq_get_status
 * @param {object} args - Tool arguments
 * @returns {Promise<object>} - Tool result
 */
async function callMCPTool(toolName, args) {
  const response = await fetch('/api/mcq', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tool: toolName,
      args: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`MCQMCP error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Generate a multiple choice question for a learning objective
 * @param {string} userId - Unique user identifier
 * @param {string} objective - The learning objective/concept to quiz on
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @returns {Promise<{question: string, options: string[], correct_answer: string}>}
 */
export async function generateQuestion(userId, objective, difficulty = 'medium') {
  const result = await callMCPTool('mcq_generate', {
    user_id: userId,
    objective: objective,
    difficulty: difficulty,
  });

  // Parse the response - MCP returns content array
  if (result.content && result.content[0]?.text) {
    try {
      return JSON.parse(result.content[0].text);
    } catch {
      // If not JSON, return raw text
      return { raw: result.content[0].text };
    }
  }
  return result;
}

/**
 * Record a learner's answer and update mastery
 * @param {string} userId - Unique user identifier
 * @param {string} objective - The learning objective
 * @param {string} selectedAnswer - The answer the user selected
 * @param {string} correctAnswer - The correct answer
 * @returns {Promise<{correct: boolean, mastery: number}>}
 */
export async function recordAnswer(userId, objective, selectedAnswer, correctAnswer) {
  const result = await callMCPTool('mcq_record', {
    user_id: userId,
    objective: objective,
    selected_answer: selectedAnswer,
    correct_answer: correctAnswer,
  });

  if (result.content && result.content[0]?.text) {
    try {
      return JSON.parse(result.content[0].text);
    } catch {
      return { raw: result.content[0].text };
    }
  }
  return result;
}

/**
 * Get mastery status for objectives
 * @param {string} userId - Unique user identifier
 * @param {string} [objective] - Optional specific objective (omit for all)
 * @returns {Promise<{objective: string, mastery: number, correct: number, total: number}[]>}
 */
export async function getMasteryStatus(userId, objective = null) {
  const args = { user_id: userId };
  if (objective) {
    args.objective = objective;
  }

  const result = await callMCPTool('mcq_get_status', args);

  if (result.content && result.content[0]?.text) {
    try {
      return JSON.parse(result.content[0].text);
    } catch {
      return { raw: result.content[0].text };
    }
  }
  return result;
}

/**
 * Generate a unique user ID (stored in localStorage)
 * @returns {string}
 */
export function getUserId() {
  let userId = localStorage.getItem('mcqmcp_user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('mcqmcp_user_id', userId);
  }
  return userId;
}

// --- Quiz Event Logging ---
const QUIZ_LOG_KEY = 'mcqmcp_quiz_log';

/**
 * Log a quiz event (question generated, answer submitted, etc.)
 * @param {string} eventType - 'question_generated' | 'answer_submitted' | 'quiz_closed'
 * @param {object} data - Event data
 */
export function logQuizEvent(eventType, data) {
  const log = getQuizLog();
  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    type: eventType,
    userId: getUserId(),
    ...data
  };
  log.push(event);
  localStorage.setItem(QUIZ_LOG_KEY, JSON.stringify(log));
  console.log(`[MCQMCP] ${eventType}:`, event);
  return event;
}

/**
 * Get all quiz events from the log
 * @returns {object[]}
 */
export function getQuizLog() {
  try {
    return JSON.parse(localStorage.getItem(QUIZ_LOG_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Clear the quiz log
 */
export function clearQuizLog() {
  localStorage.removeItem(QUIZ_LOG_KEY);
}
