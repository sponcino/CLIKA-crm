import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';
import { agentTools } from './tools';
import { searchKnowledge } from './rag';
import { dispatchWebhook } from '../webhooks/dispatcher';
import { LeadStatus } from '@prisma/client';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function runAgent(params: {
  workspaceId: string;
  contactId: string;
  conversationId: string;
  messageText: string;
  messageHistory: { role: "user" | "assistant"; content: string }[];
}): Promise<{ response: string; toolsUsed: string[] }> {
  
  // 1. Load config
  const config = await prisma.aIAgentConfig.findUnique({
    where: { workspaceId: params.workspaceId }
  });

  if (!config) {
    return { response: "El agente de IA no está configurado.", toolsUsed: [] };
  }

  // 2. Build system prompt
  const systemPrompt = `You are ${config.agentName}, an AI assistant for a business.
Business Context: ${config.businessContext || 'Not provided'}
Tone: ${config.tone}
Language: ${config.language}
Additional Rules: ${config.systemPrompt || 'None'}

Always reply in the configured language and tone.
You have access to tools to update CRM data, book appointments, and trigger webhooks. Use them when appropriate.
`;

  // 3. Call Anthropic
  const toolsUsed: string[] = [];
  let finalResponse = "";

  try {
    const message = await anthropic.messages.create({
      model: config.modelName || 'claude-sonnet-4-20250514', // updated to actual model name
      max_tokens: 1024,
      temperature: config.temperature,
      system: systemPrompt,
      tools: agentTools,
      messages: [
        { role: 'user', content: params.messageText }
      ]
    });

    // 4. Handle Tool Calls
    const toolCalls = message.content.filter(c => c.type === 'tool_use');
    const textBlocks = message.content.filter(c => c.type === 'text');
    
    if (textBlocks.length > 0 && textBlocks[0].type === 'text') {
      finalResponse = textBlocks[0].text;
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'tool_use') continue;
      
      const { name, input } = toolCall;
      toolsUsed.push(name);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const args = input as Record<string, any>;
      let toolResult = "Success";

      try {
        switch (name) {
          case 'update_contact':
            await prisma.contact.update({
              where: { id: params.contactId },
              data: {
                fullName: args.full_name,
                email: args.email,
                company: args.company,
                businessType: args.business_type,
                needSummary: args.need_summary,
              }
            });
            break;
            
          case 'update_lead_status':
            await prisma.contact.update({
              where: { id: params.contactId },
              data: { status: args.status as LeadStatus }
            });
            break;
            
          case 'update_lead_score':
            await prisma.contact.update({
              where: { id: params.contactId },
              data: { leadScore: args.score }
            });
            break;
            
          case 'escalate_to_human':
            await prisma.contact.update({
              where: { id: params.contactId },
              data: { aiEnabled: false }
            });
            await prisma.conversation.update({
              where: { id: params.conversationId },
              data: { status: 'HUMAN_REQUIRED', aiActive: false }
            });
            if (!finalResponse) {
              finalResponse = config.humanEscalationMessage || "Un agente humano se contactará contigo pronto.";
            }
            break;

          case 'search_knowledge':
            toolResult = await searchKnowledge(params.workspaceId, args.query);
            break;

          case 'trigger_webhook':
            await dispatchWebhook(params.workspaceId, args.event, args.payload);
            break;

          // Placeholder for agenda logic (M5/M6)
          case 'check_availability':
          case 'create_appointment':
          case 'reschedule_appointment':
          case 'cancel_appointment':
            toolResult = "Agenda integration pending.";
            break;
        }

        // Log tool execution
        await prisma.auditLog.create({
          data: {
            workspaceId: params.workspaceId,
            action: 'ai_tool_call',
            details: JSON.stringify({ tool: name, input: args, result: toolResult })
          }
        });

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error executing tool ${name}:`, err);
        await prisma.auditLog.create({
          data: {
            workspaceId: params.workspaceId,
            action: 'ai_tool_call_error',
            details: JSON.stringify({ tool: name, input: args, error: errMsg })
          }
        });
      }
    }

    // If there were tool calls but no text response yet, we might need a follow up call.
    // For simplicity in this iteration, if finalResponse is still empty, return a fallback
    if (!finalResponse) {
      finalResponse = "Entendido. He procesado tu solicitud.";
    }

    return { response: finalResponse, toolsUsed };
  } catch (error) {
    console.error("Anthropic API Error:", error);
    return { 
      response: config.fallbackMessage || "Lo siento, tuve un problema interno. ¿Puedes intentar nuevamente?", 
      toolsUsed: [] 
    };
  }
}
