import Anthropic from '@anthropic-ai/sdk';

export const config = {
  runtime: 'edge',
};

// Provider configurations
const PROVIDERS = {
  claude: {
    models: {
      default: 'claude-sonnet-4-5-20250514',
      fast: 'claude-haiku-3-5-20241022'
    }
  },
  openai: {
    models: {
      default: 'gpt-4o',
      fast: 'gpt-4o-mini'
    }
  },
  gemini: {
    models: {
      default: 'gemini-1.5-pro',
      fast: 'gemini-1.5-flash'
    }
  },
  grok: {
    models: {
      default: 'grok-beta',
      fast: 'grok-beta'
    }
  }
};

// Pricing per million tokens (for cost tracking)
const PRICING = {
  'claude-sonnet-4-5-20250514': {
    input: 3.00,
    output: 15.00,
    cache_write: 3.75,
    cache_read: 0.30
  },
  'claude-haiku-3-5-20241022': {
    input: 0.80,
    output: 4.00,
    cache_write: 1.00,
    cache_read: 0.08
  },
  'gpt-4o': {
    input: 2.50,
    output: 10.00
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.60
  }
};

// Auto-select best provider based on availability
function selectProvider(requestedProvider) {
  if (requestedProvider === 'auto') {
    // Priority: Claude > OpenAI > Gemini > Grok
    if (process.env.ANTHROPIC_API_KEY) return 'claude';
    if (process.env.OPENAI_API_KEY) return 'openai';
    if (process.env.GOOGLE_API_KEY) return 'gemini';
    if (process.env.XAI_API_KEY) return 'grok';
    return 'claude'; // fallback
  }
  return requestedProvider;
}

// Claude handler with prompt caching
async function handleClaude(messages, system, model) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const modelId = model || PROVIDERS.claude.models.default;

  // Format messages for caching - cache the conversation history
  const formattedMessages = messages.map((msg, idx) => {
    // Cache the second-to-last message (helps with multi-turn caching)
    const shouldCache = idx === messages.length - 2 && messages.length > 1;

    if (shouldCache) {
      return {
        role: msg.role,
        content: [
          {
            type: 'text',
            text: msg.content,
            cache_control: { type: 'ephemeral' }
          }
        ]
      };
    }
    return msg;
  });

  const requestOptions = {
    model: modelId,
    max_tokens: 8192,
    messages: formattedMessages,
  };

  // Cache the system prompt (most effective for caching)
  if (system) {
    requestOptions.system = [
      {
        type: 'text',
        text: system,
        cache_control: { type: 'ephemeral' }
      }
    ];
  }

  return { stream: anthropic.messages.stream(requestOptions), modelId };
}

// OpenAI handler
async function handleOpenAI(messages, system, model) {
  const apiKey = process.env.OPENAI_API_KEY;

  const formattedMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || PROVIDERS.openai.models.default,
      messages: formattedMessages,
      max_tokens: 8192,
      stream: true
    })
  });

  return response.body;
}

// Gemini handler
async function handleGemini(messages, system, model) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const modelId = model || PROVIDERS.gemini.models.default;

  // Convert messages to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: {
          maxOutputTokens: 8192
        }
      })
    }
  );

  return response.body;
}

// Grok handler (xAI)
async function handleGrok(messages, system, model) {
  const apiKey = process.env.XAI_API_KEY;

  const formattedMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || PROVIDERS.grok.models.default,
      messages: formattedMessages,
      max_tokens: 8192,
      stream: true
    })
  });

  return response.body;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { messages, system, provider: requestedProvider = 'auto', model } = await req.json();

    const provider = selectProvider(requestedProvider);

    // Check for API key
    const keyMap = {
      claude: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      gemini: 'GOOGLE_API_KEY',
      grok: 'XAI_API_KEY'
    };

    if (!process.env[keyMap[provider]]) {
      return new Response(JSON.stringify({
        error: `${provider} API key not configured`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();

    // Handle Claude (has native streaming support via SDK)
    if (provider === 'claude') {
      const { stream, modelId } = await handleClaude(messages, system, model);
      const pricing = PRICING[modelId] || PRICING['claude-sonnet-4-5-20250514'];

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                const text = chunk.delta.text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text, provider: 'claude' })}\n\n`));
              }
            }

            const finalMessage = await stream.finalMessage();
            if (finalMessage?.usage) {
              const usage = finalMessage.usage;

              // Calculate costs
              const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
              const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;
              const cacheWriteCost = ((usage.cache_creation_input_tokens || 0) / 1_000_000) * pricing.cache_write;
              const cacheReadCost = ((usage.cache_read_input_tokens || 0) / 1_000_000) * pricing.cache_read;
              const totalCost = inputCost + outputCost + cacheWriteCost + cacheReadCost;

              // Calculate savings from cache
              const cacheReadTokens = usage.cache_read_input_tokens || 0;
              const savingsFromCache = (cacheReadTokens / 1_000_000) * (pricing.input - pricing.cache_read);

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'usage',
                usage: {
                  ...usage,
                  model: modelId,
                  cost: {
                    input: inputCost.toFixed(6),
                    output: outputCost.toFixed(6),
                    cache_write: cacheWriteCost.toFixed(6),
                    cache_read: cacheReadCost.toFixed(6),
                    total: totalCost.toFixed(6),
                    savings: savingsFromCache.toFixed(6)
                  }
                }
              })}\n\n`));
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('Claude streaming error:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Handle OpenAI-compatible APIs (OpenAI, Grok)
    if (provider === 'openai' || provider === 'grok') {
      const responseStream = provider === 'openai'
        ? await handleOpenAI(messages, system, model)
        : await handleGrok(messages, system, model);

      const reader = responseStream.getReader();
      const decoder = new TextDecoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

              for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content, provider })}\n\n`));
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Handle Gemini (different streaming format)
    if (provider === 'gemini') {
      const responseStream = await handleGemini(messages, system, model);
      const reader = responseStream.getReader();
      const decoder = new TextDecoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              // Gemini returns JSON array chunks
              try {
                // Try to parse accumulated buffer
                const jsonMatch = buffer.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  for (const item of parsed) {
                    const text = item.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text, provider: 'gemini' })}\n\n`));
                    }
                  }
                  buffer = buffer.slice(jsonMatch.index + jsonMatch[0].length);
                }
              } catch (e) {
                // Keep accumulating if not valid JSON yet
              }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown provider' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
