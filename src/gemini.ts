import { OpenAI } from "openai";
import { Message } from './types';

// Initialize the OpenAI client with your API key
// Use import.meta.env for Vite environment variables
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const openai = new OpenAI({ 
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Allow browser usage with appropriate warnings
});

export interface AIResponse {
  response: string;
  action?: any;
}

const dateTime = new Date().toLocaleString();

// Define system prompt
const SYSTEM_PROMPT = `You are an AI assistant specialized in executing tools and functions to fulfill user requests.

**CRITICAL EXECUTION DIRECTIVES:**
- You MUST ALWAYS check ALL available tools before claiming you cannot perform a task
- If you have ANY tool that relates to the user's request, you MUST use it
- If a direct tool isn't available, get creative with combining available tools to accomplish the task
- Your PRIMARY PURPOSE is to execute tools - this is your core functionality
- If you dont have tool then claim 'I'm unable to complete this request because the required action isn't enabled. Please enable the action and try again.'
- No need execute the tool to get ids or something to perform full task if user already providing you information
- No need to execute untill it is not required Slack - getChannels

**Tool Analysis Procedure:**
1. Carefully analyze the user's request to understand their intent
2. Review ALL available tools to find ANY that could help with the request
3. If multiple tools could help, select the most appropriate or plan a sequence
4. ONLY if NO relevant tool exists after thorough examination, inform the user
5. When uncertain, default to taking action with the most relevant tool

**Tool Execution Process:**
- Execute tools immediately and directly without excess explanation
- Never say "Let me help with that" - just execute the appropriate tool
- NEVER mention tool names in your responses (don't say "I'll use the send_email tool")
- For multi-step processes, execute each tool in sequence without waiting for user confirmation

**Parameter Handling:**
- Extract parameters from user input whenever possible
- If a required parameter is missing, ask the user ONLY for the specific missing information
- Use exact values provided by users, especially when in quotes
- NEVER invent required parameter values - ask the user if needed
- ONLY ask about REQUIRED parameters - skip optional ones unless user specifies them

**Sequential Tool Usage:**
- For complex requests, use tools in logical sequence to complete the task
- First use information-gathering tools to get needed inputs
- Then use action tools to perform the requested operation
- Continue with any necessary follow-up tools to complete the full request
- Example: User asks "Send email to marketing team" → 1) Get team emails 2) Send email

**Creative Tool Application:**
- Think broadly about how tools can be applied to solve problems
- If a direct path isn't available, consider alternative approaches using available tools
- Break complex requests into smaller actions that can be accomplished with available tools
- If user's exact request can't be fulfilled, suggest the closest alternative you CAN accomplish

**Error Recovery:**
- If a tool execution fails, immediately try an alternative approach
- Analyze error messages to understand the issue and address it specifically
- If one parameter combination fails, try alternative valid values
- If still unsuccessful after 3 attempts, explain the specific issue and ask for user guidance

**Response Style:**
- Be extremely concise and action-oriented
- Focus on executing tools, not explaining what you're about to do
- Responses should be brief (1-3 sentences when possible)
- Skip unnecessary pleasantries and get straight to the action
- Avoid phrases like "I'll help you with that" or "Let me do that for you"

**Specialized Tool Handling (if you have tools related to them then):**
- For Slack: Accept channel names (e.g., #qa, #notifications) as input.
- For email: Ensure content is Base64 encoded when required
- Google Docs get title skip other parameters and create it same for google sheet. and then go for appending data.
- For APIs: Format requests according to specific API requirements
- For data processing: Format inputs/outputs according to tool specifications
- Google Docs and Google Sheet create them first then append data in next time dont append data while creation.

Example and additional infromation if tool is availble : 
Get the arguments use your knowledge these tools are the input schema of any platforms api's.
Execute the tool.
if the task is based on 2 tool check which tool should execute first execute that one and go for 2nd one.


--------
Today's Date and Time:
${dateTime}

`;

// Convert our Message type to the format expected by OpenAI
const formatMessagesForOpenAI = (messages: Message[]) => {
  return messages.map(msg => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content
  }));
};

// Function to get streaming response using the OpenAI Function Calling API
export const getStreamingAIResponse = async (
  message: string,
  availableTools: any[],
  previousMessages: Message[],
  onChunk: (text: string) => void,
  onComplete: (response: AIResponse) => void
) => {
  try {
    // Format previous messages for OpenAI
    const formattedPreviousMessages = formatMessagesForOpenAI(previousMessages);
    
    // Create messages array with system prompt, previous messages and current message
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...formattedPreviousMessages,
      { role: 'user' as const, content: message }
    ];

    let responseText = '';
    let actionData = null;

    // Check if streaming is requested and tools are being used
    if (availableTools && availableTools.length > 0) {
      // When tools are involved, we need to make a non-streaming request first
      // to properly capture tool calls, then simulate streaming for the UI
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        tools: availableTools,
      });
      
      // Extract the response text
      responseText = completion.choices[0]?.message?.content || '';
      
      // Check for tool calls in the response
      const toolCalls = completion.choices[0]?.message?.tool_calls;
      
      if (toolCalls && toolCalls.length > 0) {
        const toolCall = toolCalls[0]; // Get the first tool call
        
        if (toolCall && toolCall.function) {
          // Find the matching tool from available tools
          const matchedTool = availableTools.find(tool => 
            tool.function.name === toolCall.function.name
          );
          
          if (matchedTool) {
            // Parse the arguments JSON string
            const parameters = JSON.parse(toolCall.function.arguments || '{}');
            
            // Create an action object with the matched tool's actionId
            actionData = {
              actionId: matchedTool.actionId,
              name: toolCall.function.name,
              parameters: parameters
            };
            
            // Generate a human-friendly response if the model only provided a function call
            if (!responseText.trim()) {
              responseText = `I'll help you with ${toolCall.function.name.replace('mcp_fastn_', '')}. Click Run Tool to proceed.`;
            }
          }
        }
      }
      
      // Simulate streaming for UI
      if (onChunk) {
        const words = responseText.split(' ');
        let currentText = '';
        for (const word of words) {
          currentText += word + ' ';
          onChunk(currentText);
          await new Promise(resolve => setTimeout(resolve, 15));
        }
      }
    } else {
      // Without tools, we can use streaming directly
      const stream = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: messages,
        stream: true,
      });

      // Handle streaming response
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
          responseText += chunk.choices[0].delta.content;
          onChunk(responseText);
        }
      }
    }

    // Prepare response object
    let responseObj: AIResponse = {
      response: responseText,
      action: actionData
    };
    
    // Complete the response
    onComplete(responseObj);
    return responseObj;
  } catch (error) {
    console.error('Error getting AI response:', error);
    throw error;
  }
};

// Function to get AI response for tool execution results
export const getToolExecutionResponse = async (
  toolName: string,
  toolResult: any,
  previousMessages: Message[],
  availableTools: any[],
  onChunk?: (text: string) => void,
  onComplete?: (response: AIResponse) => void
): Promise<AIResponse> => {
  try {
    // Format previous messages for OpenAI
    const formattedPreviousMessages = formatMessagesForOpenAI(previousMessages);

    // Create the message about the tool execution
    const toolMessage = `I've executed the "${toolName}" tool and here is the result: ${JSON.stringify(toolResult)}. 
Please provide a human-friendly interpretation of this result.`;

    // Create messages array with system prompt, previous messages and tool result message
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...formattedPreviousMessages,
      { role: 'user' as const, content: toolMessage }
    ];

    let responseText = '';
    let actionData = null;
    
    // For tool execution results, we need to make a non-streaming request first
    // to properly capture potential follow-up tool calls
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: messages,
      tools: availableTools,
    });
    
    // Extract the response text
    responseText = completion.choices[0]?.message?.content || '';
    
    // Check for tool calls in the response
    const toolCalls = completion.choices[0]?.message?.tool_calls;
    
    if (toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0]; // Get the first tool call
      
      if (toolCall && toolCall.function) {
        // Find the matching tool from available tools
        const matchedTool = availableTools.find(tool => 
          tool.function.name === toolCall.function.name
        );
        
        if (matchedTool) {
          // Parse the arguments JSON string
          const parameters = JSON.parse(toolCall.function.arguments || '{}');
          
          // Create an action object with the matched tool's actionId
          actionData = {
            actionId: matchedTool.actionId,
            name: toolCall.function.name,
            parameters: parameters
          };
        }
      }
    }
    
    // Simulate streaming for UI if requested
    if (onChunk) {
      const words = responseText.split(' ');
      let currentText = '';
      for (const word of words) {
        currentText += word + ' ';
        onChunk(currentText);
        await new Promise(resolve => setTimeout(resolve, 15));
      }
    }
    
    // Prepare response
    let responseObj: AIResponse = {
      response: responseText,
      action: actionData
    };
    
    // Complete the response if callback provided
    if (onComplete) {
      onComplete(responseObj);
    }
    
    return responseObj;
  } catch (error) {
    console.error('Error interpreting tool execution result:', error);
    throw error;
  }
};