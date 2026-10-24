import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  createTheme,
  NativeSelect,
  Pagination,
  Paper,
  TextInput,
  type CSSVariablesResolver,
} from "@mantine/core";
import { portalColorSchemes, portalPalette } from "./tokens";
import classes from "./portal-theme.module.css";

const inputClasses = {
  input: classes.input,
  label: classes.label,
  description: classes.description,
};

export const portalTheme = createTheme({
  colors: portalPalette,
  primaryColor: "brand",
  primaryShade: 6,
  autoContrast: true,
  defaultRadius: "md",
  fontFamily: 'var(--font-geist), "Segoe UI", Arial, sans-serif',
  headings: { fontFamily: 'var(--font-geist), "Segoe UI", Arial, sans-serif' },
  components: {
    Button: Button.extend({
      defaultProps: { size: "md", variant: "light" },
      classNames: { root: classes.button },
    }),
    ActionIcon: ActionIcon.extend({
      defaultProps: { size: 44, variant: "subtle" },
      classNames: { root: classes.actionIcon },
    }),
    TextInput: TextInput.extend({
      defaultProps: { size: "md" },
      classNames: inputClasses,
    }),
    NativeSelect: NativeSelect.extend({
      defaultProps: { size: "md" },
      classNames: inputClasses,
    }),
    Badge: Badge.extend({
      defaultProps: { variant: "light", size: "lg" },
      classNames: { root: classes.badge },
    }),
    Alert: Alert.extend({
      defaultProps: { variant: "light", radius: "md" },
      classNames: { root: classes.alert, title: classes.alertTitle },
    }),
    Paper: Paper.extend({
      defaultProps: { withBorder: true, radius: "md" },
    }),
    Pagination: Pagination.extend({
      defaultProps: { size: "md" },
      classNames: { control: classes.paginationControl },
    }),
  },
});

export const portalCssVariables: CSSVariablesResolver = (theme) => ({
  variables: {
    "--accent-fill": theme.colors.brand[6],
    "--on-accent": "#232323",
    "--accent-hover": theme.colors.brand[4],
    "--accent-border": "color-mix(in srgb, var(--gold) 34%, var(--surface))",
    "--accent-tint":
      "color-mix(in srgb, var(--mantine-color-brand-6) 8%, transparent)",
    "--accent-tint-strong":
      "color-mix(in srgb, var(--mantine-color-brand-6) 15%, transparent)",
    "--accent-surface":
      "color-mix(in srgb, var(--mantine-color-brand-6) 10%, var(--surface))",
  },
  light: colorSchemeVariables(portalColorSchemes.light),
  dark: colorSchemeVariables(portalColorSchemes.dark),
});

function colorSchemeVariables(tokens: typeof portalColorSchemes.dark) {
  return {
    ...Object.fromEntries(
      Object.entries(tokens).map(([name, value]) => [
        `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
        value,
      ]),
    ),
    "--mantine-color-body": tokens.paper,
    "--mantine-color-text": tokens.ink,
    "--mantine-color-dimmed": tokens.dim,
    "--mantine-color-default": tokens.surface,
    "--mantine-color-default-hover": tokens.surfaceRaised,
    "--mantine-color-default-color": tokens.ink,
    "--mantine-color-default-border": tokens.line,
    "--mantine-color-brand-light-color": tokens.goldSoft,
    "--mantine-color-brand-text": tokens.gold,
    "--mantine-color-brand-outline": tokens.gold,
  };
}
