import React, { useState } from 'react';
import { Message } from '../types';
import { PlayCircle, ChevronDown, ChevronUp, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Components } from 'react-markdown';

interface ChatMessageProps {
  message: Message;
  onExecuteTool?: (actionData: any) => void;
  isLoading?: boolean;
  toolResults?: any;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  onExecuteTool, 
  isLoading = false,
  toolResults
}) => {
  const isUser = message.role === 'user';
  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  
  // Format JSON for display with proper syntax highlighting
  const formatJson = (json: any) => {
    try {
      return JSON.stringify(json, null, 2);
    } catch (e) {
      return typeof json === 'string' ? json : 'Invalid JSON';
    }
  };
  
  // Extract tool ID from actionId
  const getToolId = (actionId: string) => {
    if (!actionId) return '';
    const parts = actionId.split('_');
    return parts.length > 1 ? parts[parts.length - 1] : actionId;
  };

  // Determine if we should show the Run Tool button
  const showRunToolButton = !isUser && message.hasAction && message.actionData && !toolResults;

  // Define markdown components with proper typing
  const markdownComponents: Components = {
    code({ className, children, ...props }: any) {
      // The inline prop comes from MDX which isn't used here, but we need to check
      // if there's a language specified in the className
      const match = /language-(\w+)/.exec(className || '');
      const inline = !match;
      
      return !inline ? (
        <pre className="bg-gray-800 rounded-md p-2 my-2 overflow-x-auto">
          <code
            className={`text-sm ${match ? `language-${match[1]}` : ''} text-green-400`}
            {...props}
          >
            {children}
          </code>
        </pre>
      ) : (
        <code
          className={`px-1 py-0.5 bg-gray-200 rounded-sm text-sm ${isUser ? 'text-blue-900' : 'text-blue-700'}`}
          {...props}
        >
          {children}
        </code>
      );
    },
    table({ ...props }) {
      return (
        <div className="overflow-x-auto my-3">
          <table className="border-collapse border border-gray-300" {...props} />
        </div>
      );
    },
    thead({ ...props }) {
      return <thead className="bg-gray-200" {...props} />;
    },
    th({ ...props }) {
      return <th className="border border-gray-300 px-4 py-2 text-left" {...props} />;
    },
    td({ ...props }) {
      return <td className="border border-gray-300 px-4 py-2" {...props} />;
    },
    a({ ...props }) {
      return <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />;
    },
    ul({ ...props }) {
      return <ul className="list-disc pl-6 my-2" {...props} />;
    },
    ol({ ...props }) {
      return <ol className="list-decimal pl-6 my-2" {...props} />;
    },
    blockquote({ ...props }) {
      return <blockquote className="border-l-4 border-gray-300 pl-4 py-1 my-2 italic" {...props} />;
    },
    img({ ...props }) {
      return <img className="max-w-full h-auto rounded-md my-2" {...props} />;
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`rounded-lg px-4 py-3 max-w-[90%] ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-800'
        } ${message.isStreaming ? 'border-l-4 border-green-500 animate-pulse' : ''}
        ${message.isToolExecution ? 'border border-gray-300 bg-gray-50 italic' : ''}
        ${showRunToolButton ? 'border-2 border-green-400' : ''}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-medium ${isUser ? 'text-blue-100' : 'text-gray-600'}`}>
            {isUser ? 'You' : 'Assistant'}
          </span>
          <span className={`text-xs ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          {message.isStreaming && (
            <span className="text-xs text-green-600 font-medium">
              Typing...
            </span>
          )}
        </div>

        {/* Render content as markdown for non-user messages, plain text for user */}
        <div className={`markdown-content ${isUser ? 'text-white' : 'text-gray-800'}`}>
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]} 
              rehypePlugins={[rehypeRaw]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        
        {/* Run Tool button when action is available */}
        {showRunToolButton && (
          <div className="mt-3 py-2 border-t border-green-300">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-green-700">Ready to Execute</span>
              <button
                onClick={() => onExecuteTool && onExecuteTool(message.actionData)}
                disabled={isLoading}
                className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-md"
              >
                <PlayCircle className="w-4 h-4" />
                Run Tool
              </button>
            </div>
          </div>
        )}
        
        {/* Collapsible Tool Parameters */}
        {!isUser && message.hasAction && message.actionData && (
          <div className="mt-3 border-t border-gray-200 pt-2">
            <div 
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-blue-600" 
              onClick={() => setIsParamsOpen(!isParamsOpen)}
            >
              {isParamsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span className="font-medium">
                Tool: {getToolId(message.actionData.actionId)}
              </span>
              {message.actionData?.name && (
                <span className="text-blue-600">{message.actionData.name.replace('mcp_fastn_', '')}</span>
              )}
            </div>
            
            {isParamsOpen && (
              <div className="mt-2 pl-6">
                <p className="text-sm font-medium text-gray-700 mb-1">Parameters:</p>
                <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-xs overflow-x-auto">
                  {formatJson(message.actionData.parameters)}
                </pre>
              </div>
            )}
            
            {/* Show tool execution results if available */}
            {toolResults && (
              <>
                <div 
                  className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-blue-600 mt-2" 
                  onClick={() => setIsResultsOpen(!isResultsOpen)}
                >
                  {isResultsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <span className="font-medium">Result</span>
                  <Check size={16} className="text-green-500" />
                </div>
                
                {isResultsOpen && (
                  <div className="mt-2 pl-6">
                    <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-xs overflow-x-auto">
                      {formatJson(toolResults)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};