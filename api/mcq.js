// Serverless function to proxy MCQMCP tool calls
// MCQMCP server REST API at https://mcqmcp.onrender.com/api/tools/call

export const config = {
  runtime: 'edge',
};

const MCQMCP_URL = 'https://mcqmcp.onrender.com';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { tool, args } = await req.json();

    // Call the MCQMCP REST API endpoint
    const response = await fetch(`${MCQMCP_URL}/api/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: tool,
        arguments: args,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      // Transform REST API response to MCP content format for backwards compatibility
      if (result.success && result.result) {
        return new Response(JSON.stringify({
          content: [{
            type: 'text',
            text: JSON.stringify(result.result)
          }]
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If MCQMCP server is unavailable, fall back to local generation
    console.log('MCQMCP server unavailable, using fallback');

    if (tool === 'mcq_generate') {
      return await generateQuestionWithClaude(args);
    }

    // For record and status, return mock responses if server unavailable
    if (tool === 'mcq_record') {
      const isCorrect = args.selected_answer === args.correct_answer;
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: JSON.stringify({
            was_correct: isCorrect,
            correct: isCorrect ? 1 : 0,
            total: 1,
            mastery: isCorrect ? 1.0 : 0.0
          })
        }]
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (tool === 'mcq_get_status') {
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: JSON.stringify({
            user_id: args.user_id,
            objective: args.objective || null,
            objectives: [],
            status: 'no_data'
          })
        }]
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown tool' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('MCQ API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Fallback: Generate questions using Claude when MCQMCP server is unavailable
async function generateQuestionWithClaude(args) {
  const { objective, difficulty = 'medium' } = args;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Return a generic fallback question
    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({
          question: `Which of the following best describes ${objective}?`,
          options: [
            'A fundamental programming concept',
            'A design pattern for software architecture',
            'A method for organizing code',
            'All of the above could apply'
          ],
          correct_answer: 'All of the above could apply'
        })
      }]
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Generate a ${difficulty} multiple choice question to test understanding of "${objective}".

Return ONLY valid JSON in this exact format:
{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": "The correct option exactly as written in options"
}

Make the question specific and educational. The incorrect options should be plausible but clearly wrong to someone who understands the concept.`
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Parse the JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: JSON.stringify(parsed)
        }]
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Could not parse question from response');
  } catch (error) {
    // Final fallback
    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({
          question: `What is a key characteristic of ${objective}?`,
          options: [
            'It simplifies complex operations',
            'It improves code organization',
            'It enables better abstraction',
            'It depends on the specific use case'
          ],
          correct_answer: 'It depends on the specific use case'
        })
      }]
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
