import express from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";

const app = express();
app.use(express.json());

// Serve a simple HTML client
app.get("/", (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Claude Agent Stream</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    #prompt { width: 100%; padding: 10px; font-size: 16px; }
    #run { padding: 10px 20px; font-size: 16px; cursor: pointer; }
    #output { margin-top: 20px; border: 1px solid #ccc; padding: 15px; min-height: 200px; }
    .thinking { color: #666; margin: 8px 0; }
    .tool { color: #0066cc; margin: 8px 0; font-weight: 500; }
    .result { color: #888; margin: 4px 0 12px 20px; font-size: 14px; white-space: pre-wrap; }
    .done { color: #228b22; font-weight: bold; margin-top: 15px; }
    .error { color: #cc0000; }
  </style>
</head>
<body>
  <h1>Claude Agent Streaming Demo</h1>
  <input id="prompt" placeholder="Enter a prompt for the agent..." value="Review utils.py and describe what it does">
  <button id="run">Run Agent</button>
  <div id="output"></div>

  <script>
    document.getElementById('run').onclick = () => {
      const prompt = document.getElementById('prompt').value;
      const output = document.getElementById('output');
      output.innerHTML = '';

      const eventSource = new EventSource('/stream?prompt=' + encodeURIComponent(prompt));

      eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const div = document.createElement('div');
        div.className = data.type;

        switch (data.type) {
          case 'thinking':
            div.textContent = data.content;
            break;
          case 'tool_start':
            div.textContent = '🔧 ' + data.content;
            break;
          case 'tool_result':
            div.textContent = '↳ ' + data.content;
            break;
          case 'done':
            div.textContent = '✓ ' + data.content;
            eventSource.close();
            break;
          case 'error':
            div.textContent = '✗ ' + data.content;
            eventSource.close();
            break;
        }

        output.appendChild(div);
        output.scrollTop = output.scrollHeight;
      };

      eventSource.onerror = () => {
        eventSource.close();
      };
    };
  </script>
</body>
</html>
  `);
});

// SSE streaming endpoint
app.get("/stream", async (req, res) => {
  const prompt = req.query.prompt as string;
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
    for await (const message of query({
      prompt,
      options: {
        allowedTools: ["Read", "Edit", "Glob", "Grep", "Bash"],
        permissionMode: "acceptEdits"
      }
    })) {
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
        send({
          type: "done",
          content: message.subtype === "success"
            ? "Task completed"
            : `Ended: ${message.subtype}`
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
