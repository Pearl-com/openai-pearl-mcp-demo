import { MODEL, SYSTEM_PROMPT } from "@/config/constants";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    console.log("Received messages:", messages);

    const openai = new OpenAI();

    const events = await openai.responses.create({
      model: MODEL,
      input: messages,
      tools: [
        {
          // @ts-expect-error ignore type error
          "type": "mcp",
          server_label: "pearl-api-mcp-server",
          server_url: "https://mcp.pearl.com/mcp",
          require_approval: "never",
          allowed_tools: ["askExpert"],
          headers: {
            "X-API-KEY": `${process.env.PEARL_API_KEY}`,
          }
        }
      ],
      stream: true,
      parallel_tool_calls: false,
      instructions: SYSTEM_PROMPT,
    });

    // Create a ReadableStream that emits SSE data
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of events) {
            // Sending all events to the client
            const data = JSON.stringify({
              event: event.type,
              data: event,
            });
            controller.enqueue(`data: ${data}\n\n`);
          }
          // End of stream
          controller.close();
        } catch (error) {
          console.error("Error in streaming loop:", error);
          controller.error(error);
        }
      },
    });

    // Return the ReadableStream as SSE
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in POST handler:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
