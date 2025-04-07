import axios from 'axios';
import { Tool } from './types';

const API_KEY = '3eada18b-a1ac-4fe8-80d4-f0df49b371ea';
const SPACE_ID = 'a964a451-7538-4e34-ac6c-693a2f087fe4';

const api = axios.create({
  baseURL: 'https://live.fastn.ai/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'x-fastn-api-key': API_KEY,
    'x-fastn-space-id': SPACE_ID,
    'x-fastn-space-tenantid': '',
    'stage': 'DRAFT',
    'x-fastn-custom-auth': 'true',
  },
});

export const getTools = async (useCase: string): Promise<Tool[]> => {
  try {
    const response = await api.post('/getTools', {
      input: {
        useCase,
        spaceId: SPACE_ID,
      },
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching tools:', error);
    throw error;
  }
};

// Cache for tools to avoid repeated requests
let toolsCache: Tool[] | null = null;

// Get all available tools and cache them
const getAllTools = async (): Promise<Tool[]> => {
  if (toolsCache) return toolsCache;
  
  try {
    const tools = await getTools('chat');
    toolsCache = tools;
    return tools;
  } catch (error) {
    console.error('Error loading tools for inference:', error);
    return [];
  }
};

// Infer the actionId from parameters and available tools
const inferActionId = async (parameters: any): Promise<string | null> => {
  const tools = await getAllTools();
  
  // Handle Google Docs/Sheets special cases
  if (parameters.body?.title || parameters.body?.properties?.title) {
    // Google Docs
    if (parameters.body?.title) {
      const docTool = tools.find(tool => 
        tool.function.name === 'mcp_fastn_createDocument' || 
        tool.function.description.includes('Google Docs')
      );
      return docTool?.actionId || null;
    }
    
    // Google Sheets
    if (parameters.body?.properties?.title) {
      const sheetTool = tools.find(tool => 
        tool.function.name === 'mcp_fastn_createSpreadsheet' || 
        tool.function.description.includes('Google Sheet')
      );
      return sheetTool?.actionId || null;
    }
  }
  
  // Handle Gmail
  if (parameters.body?.raw) {
    const emailTool = tools.find(tool => 
      tool.function.name === 'mcp_fastn_sendMail' || 
      tool.function.description.includes('Gmail')
    );
    return emailTool?.actionId || null;
  }
  
  return null;
};

export const executeTool = async (actionId: string | null, parameters: Record<string, any>) => {
  try {
    // If we don't have an actionId, try to infer it from parameters
    const finalActionId = actionId || await inferActionId(parameters);
    
    if (!finalActionId) {
      throw new Error('Unable to determine which tool to execute. Invalid or missing actionId.');
    }
    
    console.log(`Executing tool with actionId: ${finalActionId}`, parameters);
    
    const response = await api.post('/executeTool', {
      input: {
        actionId: finalActionId,
        parameters,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error executing tool:', error);
    throw error;
  }
};