export interface ThemeDefinition {
  id: string;
  label: string;
  description: string;
  colors: {
    primary: string;
    sidebar: string;
    accent: string;
  };
}

export const themes: ThemeDefinition[] = [
  {
    id: "hp-enterprise",
    label: "HP Enterprise",
    description: "Clean corporate with white sidebar",
    colors: {
      primary: "#004185",
      sidebar: "#f8fafc",
      accent: "#e31e24",
    },
  },
  {
    id: "enterprise-blue",
    label: "Enterprise Blue",
    description: "Navy sidebar with blue primary",
    colors: {
      primary: "#1a56db",
      sidebar: "#0a1628",
      accent: "#dbeafe",
    },
  },
];

export const DEFAULT_THEME = "hp-enterprise";
