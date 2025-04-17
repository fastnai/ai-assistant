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
        <pre className="bg-slate-800 rounded-lg p-3 my-2 overflow-x-auto shadow-inner">
          <code
            className={`text-sm ${match ? `language-${match[1]}` : ''} text-emerald-400`}
            {...props}
          >
            {children}
          </code>
        </pre>
      ) : (
        <code
          className={`px-1.5 py-0.5 rounded-md text-sm ${isUser ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-800'}`}
          {...props}
        >
          {children}
        </code>
      );
    },
    table({ ...props }) {
      return (
        <div className="overflow-x-auto my-3 rounded-lg shadow-sm">
          <table className="border-collapse w-full" {...props} />
        </div>
      );
    },
    thead({ ...props }) {
      return <thead className="bg-slate-200" {...props} />;
    },
    th({ ...props }) {
      return <th className="border border-slate-300 px-4 py-2 text-left font-semibold" {...props} />;
    },
    td({ ...props }) {
      return <td className="border border-slate-200 px-4 py-2" {...props} />;
    },
    a({ ...props }) {
      return <a className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors" target="_blank" rel="noopener noreferrer" {...props} />;
    },
    ul({ ...props }) {
      return <ul className="list-disc pl-6 my-2 space-y-1" {...props} />;
    },
    ol({ ...props }) {
      return <ol className="list-decimal pl-6 my-2 space-y-1" {...props} />;
    },
    blockquote({ ...props }) {
      return <blockquote className="border-l-4 border-indigo-300 pl-4 py-1 my-3 italic bg-slate-50 rounded-r-md" {...props} />;
    },
    img({ ...props }) {
      return <img className="max-w-full h-auto rounded-lg my-3 shadow-md" {...props} />;
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 relative`}>
     
      <div
        className={`rounded-xl px-5 py-3.5 max-w-[60%] relative ${
          isUser
            ? 'bg-[#e8eaff] text-indigo-700'
            : 'bg-gray-100 text-gray-800'
        } ${message.isStreaming ? 'border-l-4 border-[#A1A3F7] animate-pulse' : ''}
        ${message.isToolExecution ? 'border border-slate-200 bg-slate-50 italic' : ''}
        ${showRunToolButton ? 'border-2 border-[#A1A3F7]' : ''} shadow-sm `}
      >
        
        <div className="flex items-center gap-2 mb-1.5 relative z-10">
          <span className={`font-medium ${isUser ? 'text-indigo-700' : 'text-slate-700'}`}>
            {isUser ? 'You' : 'Assistant'}
          </span>
          <span className={`text-xs ${isUser ? 'text-[#5B5EF0]' : 'text-slate-500/80'}`}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          {message.isStreaming && (
            <span className="text-xs text-[#5B5EF0] font-medium">
              Typing...
            </span>
          )}
        </div>

        {/* Render content as markdown for non-user messages, plain text for user */}
        <div className={`markdown-content w-full break-words overflow-hidden ${isUser ? 'text-indigo-700' : 'text-slate-800'}`}>
          {isUser ? (
            <div className="whitespace-pre-wrap overflow-wrap-anywhere ">{message.content}</div>
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
          <div className="mt-3 py-2 border-t border-[#A1A3F7]">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-[#5B5EF0]">Ready to Execute</span>
              <button
                onClick={() => onExecuteTool && onExecuteTool(message.actionData)}
                disabled={isLoading}
                className="flex items-center gap-1.5 bg-[#E8E8FD] text-[#5B5EF0] px-4 py-2 text-sm rounded-lg hover:bg-[#D0D1FB] disabled:opacity-50 transition-all shadow-md"
              >
                <PlayCircle className="w-4 h-4" />
                Run Tool
              </button>
            </div>
          </div>
        )}
        
        {/* Collapsible Tool Parameters */}
        {!isUser && message.hasAction && message.actionData && (
          <div className="mt-3 border-t border-slate-200 pt-2">
            <div 
              className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-[#5B5EF0] transition-colors" 
              onClick={() => setIsParamsOpen(!isParamsOpen)}
            >
              {isParamsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span className="font-medium">
                Tool: {getToolId(message.actionData.actionId)}
              </span>
              {message.actionData?.name && (
                <span className="text-[#5B5EF0]">{message.actionData.name.replace('mcp_fastn_', '')}</span>
              )}
            </div>
            
            {isParamsOpen && (
              <div className="mt-2 pl-6">
                <p className="text-sm font-medium text-slate-700 mb-1">Parameters:</p>
                <pre className="bg-slate-800 text-emerald-400 p-3 rounded-lg text-xs overflow-x-auto shadow-inner">
                  {formatJson(message.actionData.parameters)}
                </pre>
              </div>
            )}
            
            {/* Show tool execution results if available */}
            {toolResults && (
              <>
                <div 
                  className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-[#5B5EF0] mt-2 transition-colors" 
                  onClick={() => setIsResultsOpen(!isResultsOpen)}
                >
                  {isResultsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <span className="font-medium">Result</span>
                  <Check size={16} className="text-[#5B5EF0]" />
                </div>
                
                {isResultsOpen && (
                  <div className="mt-2 pl-6">
                    <pre className="bg-slate-800 text-emerald-400 p-3 rounded-lg text-xs overflow-x-auto shadow-inner">
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