"use client";

import { MantineProvider } from "@mantine/core";
import { portalCssVariables, portalTheme } from "@/theme/portal-theme";

export function PortalProvider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={portalTheme}
      cssVariablesResolver={portalCssVariables}
      defaultColorScheme="dark"
    >
      {children}
    </MantineProvider>
  );
}
