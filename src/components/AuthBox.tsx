import React, { useState, ReactNode, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface AuthBoxProps {
  header: ReactNode;
  body: ReactNode;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  statusColor?: string;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

const AuthBox: React.FC<AuthBoxProps> = ({
  header,
  body,
  isCollapsible = false,
  defaultExpanded = true,
  statusColor = "bg-gray-400",
  isExpanded: externalExpanded,
  onToggle
}) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  
  // Determine if we're using controlled or uncontrolled mode
  const isControlled = externalExpanded !== undefined;
  const expanded = isControlled ? externalExpanded : internalExpanded;
  
  // Sync with external state if provided
  useEffect(() => {
    if (isControlled && externalExpanded !== undefined) {
      setInternalExpanded(externalExpanded);
    }
  }, [isControlled, externalExpanded]);

  const toggleExpand = () => {
    if (isCollapsible) {
      const newState = !expanded;
      if (!isControlled) {
        setInternalExpanded(newState);
      }
      if (onToggle) {
        onToggle(newState);
      }
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md transition-all duration-300">
      <button 
        onClick={toggleExpand}
        className={`w-full text-left flex flex-row items-center justify-between gap-2 p-3 
          ${isCollapsible ? 'cursor-pointer' : 'cursor-default'}`}
        disabled={!isCollapsible}
        aria-expanded={expanded}
        type="button"
      >
        {typeof header === 'string' ? (
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${statusColor}`} />
            <h3 className="font-semibold">{header}</h3>
          </div>
        ) : (
          <div className="flex-1">{header}</div>
        )}
        {isCollapsible && (
          <div className="text-gray-500">
            <ChevronDown 
              size={16} 
              className={`transform transition-transform duration-300 ease-in-out ${expanded ? 'rotate-180' : 'rotate-0'}`} 
            />
          </div>
        )}
      </button>
      
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out origin-top
          ${expanded ? 'max-h-96 opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-0'}`}
        style={{
          paddingLeft: expanded ? '1rem' : '0',
          paddingRight: expanded ? '1rem' : '0',
          paddingBottom: expanded ? '1rem' : '0'
        }}
      >
        {body}
      </div>
    </div>
  );
};

export default AuthBox; 