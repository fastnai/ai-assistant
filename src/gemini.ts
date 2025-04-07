import { GoogleGenAI, Type } from '@google/genai';
import { Message } from './types';

// Initialize the Generative AI client with your API key
// Use import.meta.env for Vite environment variables
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

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

// Convert our Message type to the format expected by Gemini
const formatMessagesForGemini = (messages: Message[]) => {
  return messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
};

// Convert tools to function declarations for Gemini
const convertToolsToFunctionDeclarations = (tools: any[]) => {
  return tools.map(tool => {
    // Create a deep copy of the tool to avoid modifying the original
    const toolCopy = JSON.parse(JSON.stringify(tool));
    
    // Fix missing type specifications in nested objects if they exist
    if (toolCopy.function.name === 'mcp_fastn_createMeeting') {
      // Fix the extended properties 'type' properties
      if (toolCopy.function.parameters?.properties?.body?.properties?.extendedProperties?.properties?.shared?.properties?.type) {
        toolCopy.function.parameters.properties.body.properties.extendedProperties.properties.shared.properties.type.type = "object";
      }
      
      if (toolCopy.function.parameters?.properties?.body?.properties?.extendedProperties?.properties?.private?.properties?.type) {
        toolCopy.function.parameters.properties.body.properties.extendedProperties.properties.private.properties.type.type = "object";
      }
      
      // Fix the conferenceData parameters type
      if (toolCopy.function.parameters?.properties?.body?.properties?.conferenceData?.properties?.parameters?.properties?.addOnParameters?.properties?.parameters?.properties?.type) {
        toolCopy.function.parameters.properties.body.properties.conferenceData.properties.parameters.properties.addOnParameters.properties.parameters.properties.type.type = "object";
      }
      
      // Fix the gadget preferences type
      if (toolCopy.function.parameters?.properties?.body?.properties?.gadget?.properties?.preferences?.properties?.type) {
        toolCopy.function.parameters.properties.body.properties.gadget.properties.preferences.properties.type.type = "object";
      }
    }
    
    // Recursively fix any object property named 'type' without its own type
    const fixTypeProperties = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      
      Object.keys(obj).forEach(key => {
        if (key === 'type' && typeof obj[key] === 'object' && !obj[key].type) {
          // Add the missing type property
          obj[key].type = 'object';
        } else if (typeof obj[key] === 'object') {
          // Recursively check nested objects
          fixTypeProperties(obj[key]);
        }
      });
    };
    
    // Apply the fix to the entire parameters object
    if (toolCopy.function.parameters) {
      fixTypeProperties(toolCopy.function.parameters);
    }
    
    return {
      name: toolCopy.function.name,
      description: toolCopy.function.description,
      parameters: toolCopy.function.parameters
    };
  });
};

// Function to get streaming response using the Gemini Function Calling API
export const getStreamingAIResponse = async (
  message: string,
  availableTools: any[],
  previousMessages: Message[],
  onChunk: (text: string) => void,
  onComplete: (response: AIResponse) => void
) => {
  try {
    // Format previous messages for Gemini
    const formattedPreviousMessages = formatMessagesForGemini(previousMessages);
    
    // Convert tools to function declarations for Gemini
    const functionDeclarations = convertToolsToFunctionDeclarations(availableTools);
    
    // Create content array with system prompt, previous messages and current message
    const contents = [
      { role: 'model', parts: [{ text: SYSTEM_PROMPT }] },
      ...formattedPreviousMessages,
      { role: 'user', parts: [{ text: message }] }
    ];

    // Send the request with function declarations exactly like the example
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: contents,
      config: {
        tools: [{
          functionDeclarations: functionDeclarations
        }],
      },
    });

    // Get the text response - accessing property directly instead of using method
    const responseText = result?.text || '';
    
    // Simulate streaming
    if (onChunk) {
      const words = responseText.split(' ');
      let currentText = '';
      for (const word of words) {
        currentText += word + ' ';
        onChunk(currentText);
        await new Promise(resolve => setTimeout(resolve, 15));
      }
    }

    // Prepare response object
    let responseObj: AIResponse = {
      response: responseText,
      action: null
    };

    // Check for function calls in the response exactly like the example
    if (result?.functionCalls && result.functionCalls.length > 0) {
      const functionCall = result.functionCalls[0]; // Assuming one function call
      
      if (functionCall && functionCall.name) {
        // Find the matching tool from available tools
        const matchedTool = availableTools.find(tool => 
          tool.function.name === functionCall.name
        );
        
        if (matchedTool) {
          // Create an action object with the matched tool's actionId
          responseObj.action = {
            actionId: matchedTool.actionId,
            name: functionCall.name,
            parameters: functionCall.args || {}
          };
          
          // Generate a human-friendly response if the model only provided a function call
          if (!responseText.trim()) {
            responseObj.response = `I'll help you with ${functionCall.name.replace('mcp_fastn_', '')}. Click Run Tool to proceed.`;
          }
        }
      }
    }
    
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
    // Format previous messages for Gemini
    const formattedPreviousMessages = formatMessagesForGemini(previousMessages);

    // Convert tools to function declarations for Gemini
    const functionDeclarations = convertToolsToFunctionDeclarations(availableTools);

    // Create the message about the tool execution
    const toolMessage = `I've executed the "${toolName}" tool and here is the result: ${JSON.stringify(toolResult)}. 
Please provide a human-friendly interpretation of this result.`;

    // Create content array with system prompt, previous messages and tool result message
    const contents = [
      { role: 'model', parts: [{ text: SYSTEM_PROMPT }] },
      ...formattedPreviousMessages,
      { role: 'user', parts: [{ text: toolMessage }] }
    ];

    // Send the request with function declarations exactly like the example
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: contents,
      config: {
        tools: [{
          functionDeclarations: functionDeclarations
        }],
      },
    });
    
    // Get the text response - accessing property directly instead of using method
    const responseText = result?.text || '';
    
    // Simulate streaming if needed
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
      action: null
    };
    
    // Check for function calls in the response exactly like the example
    if (result?.functionCalls && result.functionCalls.length > 0) {
      const functionCall = result.functionCalls[0]; // Assuming one function call
      
      if (functionCall && functionCall.name) {
        // Find the matching tool from available tools
        const matchedTool = availableTools.find(tool => 
          tool.function.name === functionCall.name
        );
        
        if (matchedTool) {
          // Create an action object with the matched tool's actionId
          responseObj.action = {
            actionId: matchedTool.actionId,
            name: functionCall.name,
            parameters: functionCall.args || {}
          };
        }
      }
    }
    
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