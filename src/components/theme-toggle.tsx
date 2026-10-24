"use client";

import {
  ActionIcon,
  Box,
  VisuallyHidden,
  useMantineColorScheme,
} from "@mantine/core";

export function ThemeToggle() {
  const { toggleColorScheme } = useMantineColorScheme();

  return (
    <div className="theme-toggle" role="group" aria-label="Tema de aparência">
      <ActionIcon
        variant="default"
        title="Alternar tema claro e escuro"
        onClick={() => toggleColorScheme()}
      >
        <Box component="span" lightHidden>
          <VisuallyHidden>Ativar modo claro</VisuallyHidden>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </Box>
        <Box component="span" darkHidden>
          <VisuallyHidden>Ativar modo escuro</VisuallyHidden>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.8 13.2A9 9 0 0 1 10.8 3.2a9 9 0 1 0 10 10Z" />
          </svg>
        </Box>
      </ActionIcon>
    </div>
  );
}
