import express from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";

const app = express();
app.use(express.json());

// Store session IDs for conversations
const conversations = new Map<string, string>();

// Serve a conversational chat interface
app.get("/", (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Claude Agent Chat</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: #f5f5f5;
    }
    .header {
      background: #2d2d2d;
      color: white;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header h1 { font-size: 18px; font-weight: 500; }
    .new-chat {
      background: #4a4a4a;
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    .new-chat:hover { background: #5a5a5a; }
    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .message {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 12px;
      line-height: 1.5;
    }
    .message.user {
      align-self: flex-end;
      background: #007bff;
      color: white;
      border-bottom-right-radius: 4px;
    }
    .message.assistant {
      align-self: flex-start;
      background: white;
      border: 1px solid #e0e0e0;
      border-bottom-left-radius: 4px;
    }
    .message-content { white-space: pre-wrap; }
    .message-meta {
      font-size: 11px;
      margin-top: 8px;
      opacity: 0.7;
    }
    .thinking {
      font-style: italic;
      color: #666;
      border-left: 3px solid #ddd;
      padding-left: 12px;
      margin: 8px 0;
    }
    .tool-call {
      background: #f0f7ff;
      border-left: 3px solid #007bff;
      padding: 8px 12px;
      margin: 8px 0;
      font-size: 13px;
      border-radius: 0 6px 6px 0;
    }
    .tool-result {
      background: #f5f5f5;
      padding: 6px 12px;
      margin: 4px 0 8px 16px;
      font-size: 12px;
      color: #666;
      border-radius: 4px;
      font-family: monospace;
    }
    .input-container {
      padding: 16px 20px;
      background: white;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 12px;
    }
    #prompt {
      flex: 1;
      padding: 12px 16px;
      font-size: 15px;
      border: 1px solid #ddd;
      border-radius: 24px;
      outline: none;
      resize: none;
      min-height: 48px;
      max-height: 120px;
      line-height: 1.4;
    }
    #prompt:focus { border-color: #007bff; }
    #send {
      background: #007bff;
      color: white;
      border: none;
      padding: 0 24px;
      border-radius: 24px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 500;
    }
    #send:hover { background: #0056b3; }
    #send:disabled { background: #ccc; cursor: not-allowed; }
    .streaming-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #007bff;
      border-radius: 50%;
      margin-left: 8px;
      animation: pulse 1s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .welcome {
      text-align: center;
      color: #888;
      padding: 40px;
    }
    .welcome h2 { font-weight: 400; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Claude Agent Chat</h1>
    <button class="new-chat" onclick="newChat()">New Chat</button>
  </div>

  <div class="chat-container" id="chat">
    <div class="welcome">
      <h2>Start a conversation</h2>
      <p>Ask Claude to help with code, files, or any task.</p>
    </div>
  </div>

  <div class="input-container">
    <textarea id="prompt" placeholder="Message Claude..." rows="1"></textarea>
    <button id="send">Send</button>
  </div>

  <script>
    let conversationId = crypto.randomUUID();
    let isStreaming = false;

    const chat = document.getElementById('chat');
    const promptInput = document.getElementById('prompt');
    const sendBtn = document.getElementById('send');

    // Auto-resize textarea
    promptInput.addEventListener('input', () => {
      promptInput.style.height = 'auto';
      promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
    });

    // Handle Enter key (Shift+Enter for new line)
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtn.onclick = sendMessage;

    function newChat() {
      conversationId = crypto.randomUUID();
      chat.innerHTML = '<div class="welcome"><h2>Start a conversation</h2><p>Ask Claude to help with code, files, or any task.</p></div>';
    }

    function sendMessage() {
      const prompt = promptInput.value.trim();
      if (!prompt || isStreaming) return;

      // Remove welcome message
      const welcome = chat.querySelector('.welcome');
      if (welcome) welcome.remove();

      // Add user message
      const userMsg = document.createElement('div');
      userMsg.className = 'message user';
      userMsg.innerHTML = '<div class="message-content"></div>';
      userMsg.querySelector('.message-content').textContent = prompt;
      chat.appendChild(userMsg);

      // Clear input
      promptInput.value = '';
      promptInput.style.height = 'auto';

      // Create assistant message container
      const assistantMsg = document.createElement('div');
      assistantMsg.className = 'message assistant';
      assistantMsg.innerHTML = '<div class="message-content"><span class="streaming-indicator"></span></div>';
      chat.appendChild(assistantMsg);

      const content = assistantMsg.querySelector('.message-content');
      chat.scrollTop = chat.scrollHeight;

      // Start streaming
      isStreaming = true;
      sendBtn.disabled = true;

      const url = '/stream?prompt=' + encodeURIComponent(prompt) + '&conversationId=' + conversationId;
      const eventSource = new EventSource(url);

      let lastThinking = null;

      eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data);

        // Remove streaming indicator if present
        const indicator = content.querySelector('.streaming-indicator');
        if (indicator) indicator.remove();

        switch (data.type) {
          case 'thinking':
            // Append or update thinking text
            if (!lastThinking) {
              lastThinking = document.createElement('div');
              lastThinking.className = 'thinking';
              content.appendChild(lastThinking);
            }
            lastThinking.textContent = data.content;
            break;

          case 'tool_start':
            lastThinking = null;
            const tool = document.createElement('div');
            tool.className = 'tool-call';
            tool.textContent = '🔧 ' + data.content;
            content.appendChild(tool);
            break;

          case 'tool_result':
            const result = document.createElement('div');
            result.className = 'tool-result';
            result.textContent = data.content;
            content.appendChild(result);
            break;

          case 'text':
            lastThinking = null;
            const text = document.createElement('div');
            text.style.marginTop = '8px';
            text.textContent = data.content;
            content.appendChild(text);
            break;

          case 'done':
            lastThinking = null;
            if (data.sessionId) {
              // Store session for debugging
              console.log('Session:', data.sessionId);
            }
            finishStream(eventSource);
            break;

          case 'error':
            lastThinking = null;
            const error = document.createElement('div');
            error.style.color = '#cc0000';
            error.textContent = '⚠️ ' + data.content;
            content.appendChild(error);
            finishStream(eventSource);
            break;
        }

        chat.scrollTop = chat.scrollHeight;
      };

      eventSource.onerror = () => {
        finishStream(eventSource);
      };
    }

    function finishStream(eventSource) {
      eventSource.close();
      isStreaming = false;
      sendBtn.disabled = false;
      promptInput.focus();

      // Remove any leftover streaming indicator
      const indicator = document.querySelector('.streaming-indicator');
      if (indicator) indicator.remove();
    }
  </script>
</body>
</html>
  `);
});

// SSE streaming endpoint with conversation support
app.get("/stream", async (req, res) => {
  const prompt = req.query.prompt as string;
  const conversationId = req.query.conversationId as string;

  if (!prompt) {
    res.status(400).send("Missing prompt");
    return;
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Get existing session ID for this conversation (if any)
    const existingSessionId = conversationId ? conversations.get(conversationId) : undefined;

    let sessionId: string | undefined;

    for await (const message of query({
      prompt,
      options: {
        allowedTools: ["Read", "Edit", "Glob", "Grep", "Bash", "Write"],
        permissionMode: "acceptEdits",
        // Resume the conversation if we have an existing session
        ...(existingSessionId ? { resume: existingSessionId } : {})
      }
    })) {
      // Capture the session ID from messages
      if ('session_id' in message && message.session_id) {
        sessionId = message.session_id;
      }

      // Stream Claude's reasoning and tool calls
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if ("text" in block && block.text) {
            send({ type: "thinking", content: block.text });
          } else if ("name" in block) {
            const toolName = block.name;
            const toolInput = (block as any).input || {};

            let content = "";
            switch (toolName) {
              case "Read":
                content = `Reading: ${toolInput.file_path}`;
                break;
              case "Edit":
                content = `Editing: ${toolInput.file_path}`;
                break;
              case "Write":
                content = `Creating: ${toolInput.file_path}`;
                break;
              case "Glob":
                content = `Finding files: ${toolInput.pattern}`;
                break;
              case "Grep":
                content = `Searching for: ${toolInput.pattern}`;
                break;
              case "Bash":
                content = `Running: ${toolInput.command?.slice(0, 50)}`;
                break;
              default:
                content = `Using: ${toolName}`;
            }

            send({ type: "tool_start", content });
          }
        }
      }

      // Stream tool results (truncated)
      if (message.type === "user" && message.message?.content) {
        for (const block of message.message.content) {
          if ("type" in block && block.type === "tool_result") {
            const resultContent = (block as any).content;
            const preview = typeof resultContent === "string"
              ? resultContent.slice(0, 150) + (resultContent.length > 150 ? "..." : "")
              : "OK";

            send({ type: "tool_result", content: preview });
          }
        }
      }

      // Stream completion
      if (message.type === "result") {
        // Store the session ID for future messages in this conversation
        if (sessionId && conversationId) {
          conversations.set(conversationId, sessionId);
        }

        send({
          type: "done",
          content: message.subtype === "success"
            ? "Task completed"
            : `Ended: ${message.subtype}`,
          sessionId
        });
      }
    }
  } catch (error) {
    send({
      type: "error",
      content: error instanceof Error ? error.message : "Unknown error"
    });
  }

  res.end();
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
