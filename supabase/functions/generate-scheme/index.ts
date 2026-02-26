import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questionPaper, textbook, marksPerQuestion, templateType } =
      await req.json();

    if (!questionPaper || !textbook) {
      return new Response(
        JSON.stringify({ error: "Question paper and textbook content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const templateInstructions: Record<string, string> = {
      vtu: "Follow VTU (Visvesvaraya Technological University) examination answer format with module-wise organization, CO mapping references, and Bloom's taxonomy levels noted.",
      autonomous: "Follow Autonomous College examination format with clear section headers (Part A, Part B, Part C), choice questions noted, and internal assessment style breakdown.",
      simple: "Use a simple, clean exam format with numbered questions, straightforward marking scheme, and concise structured answers.",
    };

    const templateInstruction = templateInstructions[templateType] || templateInstructions.simple;

    // Handle PDF base64 content
    let qpContent = questionPaper;
    let tbContent = textbook;
    if (qpContent.startsWith("[PDF_BASE64]")) {
      qpContent = "[PDF content provided - extract questions from this document]";
    }
    if (tbContent.startsWith("[PDF_BASE64]")) {
      tbContent = "[Textbook PDF content provided - use as reference material]";
    }

    const systemPrompt = `You are an expert academic marking scheme and solution generator. Your task is to:
1. Analyze the given question paper and identify individual questions
2. Using ONLY the provided textbook content as reference, generate for each question:
   - A detailed marking scheme showing point-by-point marks breakdown (totaling ${marksPerQuestion} marks per question)
   - A well-structured, comprehensive solution/answer

${templateInstruction}

CRITICAL: You must respond with valid JSON in this exact format:
{
  "questions": [
    {
      "question": "The question text",
      "scheme": [
        { "point": "Key point description", "marks": 2 },
        { "point": "Another key point", "marks": 3 }
      ],
      "solution": "Detailed structured answer text"
    }
  ]
}

Important rules:
- The marks in each scheme MUST sum to ${marksPerQuestion}
- Solutions must be based ONLY on the textbook content provided
- Keep solutions academic and well-structured
- Each scheme should have 3-6 marking points
- Respond ONLY with the JSON, no other text`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `QUESTION PAPER:\n${qpContent}\n\nTEXTBOOK CONTENT:\n${tbContent}`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI generation failed");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON from the response
    let parsed;
    try {
      // Try to extract JSON from the response (might have markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError, "Content:", content);
      throw new Error("Failed to parse AI response");
    }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-scheme error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
