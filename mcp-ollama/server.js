// 保存为 e:\LA_DUCK\la-duck\mcp-ollama\server.js
// 作用：把本地 Ollama (http://localhost:11434) 暴露为 MCP 工具，供 Trae AI 调用

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const http = require("http");

// 默认配置：从环境变量读，没有就用默认值
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";

// 小工具：用 http 模块发 POST 请求到 Ollama
function ollamaRequest(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, OLLAMA_HOST);
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let out = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (out += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(out));
          } catch (e) {
            reject(new Error("Ollama 响应不是 JSON：" + out.slice(0, 200)));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// 声明 MCP 工具
const tools = [
  {
    name: "ollama_chat",
    description:
      "用本地 Ollama 大模型对话/生成文本。适合解释代码、总结内容、写文案、做推理。",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "你要对模型说的话 / 要处理的内容",
        },
        model: {
          type: "string",
          description: "可选：指定模型名，默认 qwen2.5:7b",
          default: DEFAULT_MODEL,
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "ollama_list",
    description: "列出本机 Ollama 已下载的所有模型",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// 启动 MCP Server
async function main() {
  const server = new Server(
    {
      name: "ollama-mcp",
      version: "1.0.0",
    },
    {
      capabilities: { tools: {} },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "ollama_chat") {
        const result = await ollamaRequest("/api/generate", {
          model: args.model || DEFAULT_MODEL,
          prompt: args.prompt,
          stream: false,
        });
        return {
          content: [
            {
              type: "text",
              text: result.response || "(模型没有返回内容)",
            },
          ],
        };
      }

      if (name === "ollama_list") {
        const result = await ollamaRequest("/api/tags", {});
        const names = (result.models || []).map((m) => m.name).join("\n");
        return {
          content: [
            {
              type: "text",
              text: names || "(本机没有任何模型)",
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: "未知工具：" + name }],
        isError: true,
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text:
              "调用 Ollama 失败：" +
              (err && err.message ? err.message : String(err)) +
              "\n请确认 Ollama 是否正在运行（" +
              OLLAMA_HOST +
              "）",
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("ollama mcp server 启动失败：", err);
  process.exit(1);
});