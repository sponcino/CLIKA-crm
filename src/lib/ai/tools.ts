import { Tool } from '@anthropic-ai/sdk/resources/messages';

export const agentTools: Tool[] = [
  {
    name: "update_contact",
    description: "Updates the CRM contact information with extracted data.",
    input_schema: {
      type: "object",
      properties: {
        full_name: { type: "string", description: "The full name of the contact" },
        email: { type: "string", description: "The email address of the contact" },
        company: { type: "string", description: "The company name" },
        business_type: { type: "string", description: "The type of business they operate" },
        need_summary: { type: "string", description: "A summary of what the contact needs" }
      }
    }
  },
  {
    name: "update_lead_status",
    description: "Updates the CRM lead status of the contact.",
    input_schema: {
      type: "object",
      properties: {
        status: { 
          type: "string", 
          enum: ["NEW", "CONTACTED", "QUALIFIED", "INTERESTED", "PROPOSAL_SENT", "WON", "LOST"],
          description: "The new lead status" 
        }
      },
      required: ["status"]
    }
  },
  {
    name: "update_lead_score",
    description: "Updates the lead score from 0 to 100 based on qualification criteria.",
    input_schema: {
      type: "object",
      properties: {
        score: { type: "number", description: "Score from 0 to 100" }
      },
      required: ["score"]
    }
  },
  {
    name: "check_availability",
    description: "Checks if a specific date and duration is available for an appointment.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "ISO date string (YYYY-MM-DD)" },
        duration_minutes: { type: "number", description: "Duration in minutes" }
      },
      required: ["date", "duration_minutes"]
    }
  },
  {
    name: "create_appointment",
    description: "Books an appointment on the calendar.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        start_time: { type: "string", description: "ISO datetime string" },
        end_time: { type: "string", description: "ISO datetime string" },
        notes: { type: "string" }
      },
      required: ["title", "start_time", "end_time"]
    }
  },
  {
    name: "reschedule_appointment",
    description: "Reschedules an existing appointment.",
    input_schema: {
      type: "object",
      properties: {
        appointment_id: { type: "string" },
        new_start_time: { type: "string", description: "ISO datetime string" },
        new_end_time: { type: "string", description: "ISO datetime string" }
      },
      required: ["appointment_id", "new_start_time", "new_end_time"]
    }
  },
  {
    name: "cancel_appointment",
    description: "Cancels an existing appointment.",
    input_schema: {
      type: "object",
      properties: {
        appointment_id: { type: "string" },
        reason: { type: "string" }
      },
      required: ["appointment_id"]
    }
  },
  {
    name: "escalate_to_human",
    description: "Pauses AI processing and flags the conversation for a human agent.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why human intervention is needed" }
      },
      required: ["reason"]
    }
  },
  {
    name: "trigger_webhook",
    description: "Triggers a predefined external webhook (e.g. n8n) with a payload.",
    input_schema: {
      type: "object",
      properties: {
        event: { type: "string", description: "The event name to trigger" },
        payload: { type: "object", description: "A JSON object payload to send" }
      },
      required: ["event", "payload"]
    }
  },
  {
    name: "search_knowledge",
    description: "Searches the internal knowledge base to answer user queries.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" }
      },
      required: ["query"]
    }
  }
];
