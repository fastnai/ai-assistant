import axios from 'axios';
import { Tool } from './types';

const api = axios.create({
  baseURL: 'https://live.fastn.ai',
  headers: {
    'Content-Type': 'application/json',
    'x-fastn-space-tenantid': '',
    'stage': 'LIVE',
    'x-fastn-custom-auth': 'true',
  },
});

// Flag to prevent multiple concurrent token refreshes
let isRefreshing = false;
// Store of requests to retry after token refresh
let failedRequestsQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
  config: any;
}> = [];

// Process the queue of failed requests
const processQueue = (error: any = null) => {
  failedRequestsQueue.forEach(request => {
    if (error) {
      request.reject(error);
    } else {
      request.resolve(api(request.config));
    }
  });
  
  failedRequestsQueue = [];
};

// Update axios request config to include the latest headers before each request
api.interceptors.request.use(config => {
  // Get the auth token from localStorage for each request
  const authToken = localStorage.getItem('fastnAuthToken');
  if (authToken) {
    config.headers['authorization'] = `Bearer ${authToken}`;
  }
  return config;
});

// Add a response interceptor to handle token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // If the error is not 401 or it's already a retry, reject immediately
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    
    // Mark this request as a retry attempt
    originalRequest._retry = true;
    
    // If we're already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedRequestsQueue.push({
          resolve,
          reject,
          config: originalRequest,
        });
      });
    }
    
    isRefreshing = true;
    
    try {
      // Try to refresh the token
      // We'll use a simple fetch since we don't want to create circular dependencies
      const refreshToken = localStorage.getItem('fastnRefreshToken');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await fetch('https://live.fastn.ai/api/v1/generateFastnAccessToken', {
        method: 'POST',
        headers: {
          'x-fastn-api-key': "21112588-769a-4311-a359-cf094bee5382",
          'Content-Type': 'application/json',
          'x-fastn-space-id': "43aea445-7772-4e45-b1e8-548b96c4bf2b",
          'x-fastn-space-tenantid': '',
          'stage': 'LIVE'
        },
        body: JSON.stringify({ 
          input: {
            refresh_token: refreshToken
          } 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token in refresh response');
      }
      
      // Update the tokens in localStorage
      localStorage.setItem('fastnAuthToken', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('fastnRefreshToken', data.refresh_token);
      }
      
      // Update token expiry times
      const now = Date.now();
      const expiresIn = data.expires_in || 60; // Default to 60 minutes
      const refreshExpiresIn = data.refresh_expires_in || 1440; // Default to 1 day
      
      localStorage.setItem('fastnTokenExpiryTime', (now + (parseInt(expiresIn) * 60 * 1000)).toString());
      localStorage.setItem('fastnRefreshTokenExpiryTime', (now + (parseInt(refreshExpiresIn) * 60 * 1000)).toString());
      
      // Update the auth header for the original request
      originalRequest.headers['authorization'] = `Bearer ${data.access_token}`;
      
      // Process any queued requests
      processQueue();
      
      // Return a retry of the original request
      return api(originalRequest);
    } catch (refreshError) {
      // Process queue with error
      processQueue(refreshError);
      
      // Clear auth data on refresh failure
      localStorage.removeItem('fastnAuthToken');
      localStorage.removeItem('fastnAuthStatus');
      localStorage.setItem('fastnAuthStatus', 'error');
      
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// New function to check if connectors are available
export const getConnectors = async (spaceId: string, tenantId: string): Promise<boolean> => {
  if (!spaceId || !tenantId) {
    console.warn('Space ID or Tenant ID is missing. Cannot fetch connectors.');
    return false;
  }
  
  try {
    const response = await api.post('/api/graphql', {
      query: `query connectors($input: GetConnectorsListInput!) {
        connectors(input: $input) {
          id
        }
      }`,
      variables: {
        input: {
          projectId: spaceId,
          tenantId: tenantId,
          onlyActive: true,
          environment: "DRAFT"
        }
      }
    }, {
      headers: {
        'x-fastn-space-id': spaceId,
        'x-fastn-space-tenantid': tenantId,
        'custom-auth': 'true'
      }
    });
    
    // Check if connectors data exists and is not empty
    const connectorsData = response.data?.data?.connectors;
    const hasConnectors = Array.isArray(connectorsData) && connectorsData.length > 0;
    
    if (!hasConnectors) {
      console.log('No apps available - connectors data is empty or null');
    }
    
    return hasConnectors;
  } catch (error) {
    console.error('Error fetching connectors:', error);
    return false;
  }
};

export const getTools = async (useCase: string, spaceId: string, tenantId?: string, authToken: string): Promise<Tool[]> => {

export const getTools = async (useCase: string, spaceId: string, tenantId?: string): Promise<Tool[]> => {
  if (!spaceId) {
    console.warn('Space ID is missing. Cannot fetch tools.');
    return [];
  }
  try {
    const response = await api.post('/api/ucl/getTools', {
      input: {
        useCase,
        spaceId: spaceId,
      },
    }, {
      headers: {
        'x-fastn-space-id': spaceId,
        'x-fastn-space-tenantid': tenantId || '',
        'x-fastn-custom-auth': 'true',
        'authorization': `Bearer ${authToken}`

      }
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching tools:', error);
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new Error('Invalid API Key or Space ID. Please check your credentials.');
    }
    throw error;
  }
};

const inferActionId = (parameters: any, tools: Tool[]): string | null => {
  if (parameters.body?.title || parameters.body?.properties?.title) {
    if (parameters.body?.title) {
      const docTool = tools.find(tool =>
        tool.function.name === 'mcp_fastn_createDocument' ||
        tool.function.description.includes('Google Docs')
      );
      return docTool?.actionId || null;
    }
    if (parameters.body?.properties?.title) {
      const sheetTool = tools.find(tool =>
        tool.function.name === 'mcp_fastn_createSpreadsheet' ||
        tool.function.description.includes('Google Sheet')
      );
      return sheetTool?.actionId || null;
    }
  }
  if (parameters.body?.raw) {
    const emailTool = tools.find(tool =>
      tool.function.name === 'mcp_fastn_sendMail' ||
      tool.function.description.includes('Gmail')
    );
    return emailTool?.actionId || null;
  }
  return null;
};

export const executeTool = async (
  actionId: string | null,
  parameters: Record<string, any>,
  apiKey: string,
  spaceId: string,
  availableTools: Tool[],
  tenantId?: string,
  authToken: string
) => {

  try {
    let tool = availableTools.find(t => t.actionId === actionId);
    
    if (!tool && !actionId) {
      const inferredActionId = inferActionId(parameters, availableTools);
      if (inferredActionId) {
        tool = availableTools.find(t => t.actionId === inferredActionId);
      }
    }
    
    if (!tool) {
      console.error("Available tools for inference:", availableTools);
      console.error("Parameters for inference:", parameters);
      throw new Error('Unable to determine which tool to execute. Invalid or missing actionId.');
    }
    
    const toolActionId = tool.actionId;
    
    // Prepare headers with optional tenant ID
    const headers: Record<string, string> = {
      // 'x-fastn-api-key': apiKey,
      'x-fastn-space-id': spaceId,
      'x-fastn-space-tenantid': tenantId || '',
    };
    

    
    const response = await api.post(`/api/ucl/executeTool`, {
      input: {
        actionId: toolActionId,
        parameters: parameters
      }
    }, {
      headers
    });
    
    return response.data;
  } catch (error) {
    console.error('Error executing tool:', error);
    
    if (axios.isAxiosError(error) && (error.response?.status === 429 || error.response?.status === 503)) {
      console.log("Tool execution failed with a transient error, retrying once...");
      try {
        const retryTool = availableTools.find(t => t.actionId === actionId);
        if (!retryTool) {
          throw new Error('Tool not found for retry');
        }
        
        // Prepare headers with optional tenant ID for retry
        const headers: Record<string, string> = {
          // 'x-fastn-api-key': apiKey,
          'x-fastn-space-id': spaceId,
         'x-fastn-space-tenantid' :tenantId ||'',
         'x-fastn-custom-auth': 'true',
         'authorization': `Bearer ${authToken}`
        };
        
        // Add tenant ID to headers if provided
        // if (tenantId) {
        //   headers['x-fastn-space-tenantid'] = tenantId;
        // }
        
        const retryResponse = await api.post(`/api/ucl/executeTool`, {
          input: {
            actionId: retryTool.actionId,
            parameters: parameters
          }
        }, {
          headers
        });
        
        return retryResponse.data;
      } catch (retryError) {
        console.error('Error executing retry:', retryError);
        throw retryError;
      }
    }
    
    if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('Invalid API Key or Space ID. Failed to execute tool.');
    }
    throw error;
  }
};