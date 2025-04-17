import React from "react";
import { Button } from "./common/buttons/button";
import classNames from "classnames";
import { Tooltip } from "react-tooltip";

interface Tab {
  id: string;
  name: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}

interface ToggleTabsProps {
  className?: string;
  tabs: Tab[];
  setSelectedTab: (id: string) => void;
  selectedTab: string;
  handleOnClick?: () => void;
}

export const ToggleTabs: React.FC<ToggleTabsProps> = ({
  className = "",
  tabs,
  setSelectedTab,
  selectedTab,
  handleOnClick = () => {},
}) => {
  return (
    <div
      className={`gap-1 flex bg-gray-100 p-1 rounded-md justify-start h-full w-full
        ${className}`}
    >
      {tabs?.map((tab) => {
        const tooltipId = `tab-tooltip-${tab.id}`;
        return (
          <React.Fragment key={tab?.id}>
            <Button
              data-tooltip-id={tab.disabled && tab.disabledReason ? tooltipId : undefined}
              onClick={() => {
                if (!tab.disabled) {
                  setSelectedTab(tab?.id);
                  handleOnClick();
                }
              }}
              variant="text"
              disabled={tab.disabled}
              className={classNames(
                "w-full flex justify-center items-center px-2 py-2 border-0 font-[500] text-[12px] gap-2",
                {
                  "text-indigo-700 bg-white shadow-md active:text-indigo-700 hover:bg-white": selectedTab === tab.id,
                  "bg-transparent text-gray-400 cursor-not-allowed hover:bg-transparent": tab.disabled,
                  "bg-transparent text-gray-500 hover:bg-white": selectedTab !== tab.id && !tab.disabled
                }
              )}
            >
              {tab?.icon}
              {tab?.name}
            </Button>
            {tab.disabled && tab.disabledReason && (
              <Tooltip
                id={tooltipId}
                place="bottom"
                style={{
                  borderRadius: "4px",
                  border: "1px solid #000",
                  backgroundColor: "#000",
                  color: "#fff",
                  zIndex: 30,
                  fontSize: "12px",
                  padding: "4px 8px",
                  maxWidth: "200px"
                }}
                content={tab.disabledReason}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}; 