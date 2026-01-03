import { query } from "@anthropic-ai/claude-agent-sdk";

// Simulate sending updates to a web client
// In a real app, this would be WebSocket.send() or SSE
function sendToClient(event: {
  type: "thinking" | "tool_start" | "tool_result" | "done" | "error";
  content: string;
  metadata?: Record<string, unknown>;
}) {
  // Format for web UI consumption
  console.log(JSON.stringify(event));
}

async function runAgent(prompt: string) {
  sendToClient({
    type: "thinking",
    content: "Starting agent...",
    metadata: { prompt }
  });

  try {
    for await (const message of query({
      prompt,
      options: {
        allowedTools: ["Read", "Edit", "Glob", "Grep", "Bash"],
        permissionMode: "acceptEdits"
      }
    })) {
      // Handle Claude's reasoning and tool calls
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if ("text" in block && block.text) {
            sendToClient({
              type: "thinking",
              content: block.text
            });
          } else if ("name" in block) {
            // Tool use block - show what Claude is doing
            const toolName = block.name;
            const toolInput = (block as any).input || {};

            let friendlyMessage = "";
            switch (toolName) {
              case "Read":
                friendlyMessage = `Reading file: ${toolInput.file_path}`;
                break;
              case "Edit":
                friendlyMessage = `Editing file: ${toolInput.file_path}`;
                break;
              case "Write":
                friendlyMessage = `Creating file: ${toolInput.file_path}`;
                break;
              case "Glob":
                friendlyMessage = `Searching for files: ${toolInput.pattern}`;
                break;
              case "Grep":
                friendlyMessage = `Searching code for: ${toolInput.pattern}`;
                break;
              case "Bash":
                friendlyMessage = `Running command: ${toolInput.command}`;
                break;
              default:
                friendlyMessage = `Using tool: ${toolName}`;
            }

            sendToClient({
              type: "tool_start",
              content: friendlyMessage,
              metadata: { tool: toolName, input: toolInput }
            });
          }
        }
      }

      // Handle tool results
      if (message.type === "user" && message.message?.content) {
        for (const block of message.message.content) {
          if ("type" in block && block.type === "tool_result") {
            const resultContent = (block as any).content;
            // Truncate long results for display
            const preview = typeof resultContent === "string"
              ? resultContent.slice(0, 200) + (resultContent.length > 200 ? "..." : "")
              : JSON.stringify(resultContent).slice(0, 200);

            sendToClient({
              type: "tool_result",
              content: preview,
              metadata: { tool_use_id: (block as any).tool_use_id }
            });
          }
        }
      }

      // Handle completion
      if (message.type === "result") {
        sendToClient({
          type: "done",
          content: message.subtype === "success" ? "Task completed successfully" : `Ended: ${message.subtype}`,
          metadata: {
            subtype: message.subtype,
            result: (message as any).result
          }
        });
      }
    }
  } catch (error) {
    sendToClient({
      type: "error",
      content: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// Run with a sample prompt
const prompt = process.argv[2] || "Review utils.py for bugs and fix any issues you find.";
runAgent(prompt);
