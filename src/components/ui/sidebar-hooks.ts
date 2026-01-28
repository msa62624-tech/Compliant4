/**
 * Sidebar Hooks and Context
 * Separated from component to avoid Fast Refresh warnings
 */

import * as React from "react";

export const SidebarContext = React.createContext(null);

export function useSidebar(): JSX.Element {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}
