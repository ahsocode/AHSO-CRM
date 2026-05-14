import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        "primary-mid": "var(--color-primary-mid)",
        "primary-light": "var(--color-primary-light)",
        "primary-hover": "var(--color-primary-hover)",
        "primary-bg": "var(--color-primary-bg)",
        accent: "var(--color-accent)",
        "accent-bg": "var(--color-accent-bg)",
        "bg-page": "var(--color-bg-page)",
        "bg-card": "var(--color-bg-card)",
        "bg-sidebar": "var(--color-bg-sidebar)",
        "bg-input": "var(--color-bg-input)",
        "bg-hover": "var(--color-bg-hover)",
        "bg-subtle": "var(--color-bg-subtle)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
        "text-sidebar": "var(--color-text-sidebar)",
        success: "var(--color-success)",
        "success-bg": "var(--color-success-bg)",
        warning: "var(--color-warning)",
        "warning-bg": "var(--color-warning-bg)",
        danger: "var(--color-danger)",
        "danger-bg": "var(--color-danger-bg)",
        info: "var(--color-info)",
        "info-bg": "var(--color-info-bg)",
        border: "var(--color-border)",
        "border-light": "var(--color-border-light)",
        "border-focus": "var(--color-border-focus)",
        "stage-survey": "var(--color-stage-survey)",
        "stage-quoting": "var(--color-stage-quoting)",
        "stage-negotiating": "var(--color-stage-negotiating)",
        "stage-won": "var(--color-stage-won)",
        "stage-delivering": "var(--color-stage-delivering)",
        "stage-completed": "var(--color-stage-completed)",
        "stage-lost": "var(--color-stage-lost)"
      },
      fontFamily: {
        sans: [
          "var(--font-brand)",
          "system-ui",
          "sans-serif"
        ],
        heading: [
          "var(--font-brand)",
          "system-ui",
          "sans-serif"
        ]
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "12px",
        xl: "20px"
      },
      boxShadow: {
        sm: "0 1px 4px rgba(0, 0, 0, 0.08)",
        md: "0 4px 12px rgba(0, 0, 0, 0.12)"
      },
      minWidth: {
        app: "1280px"
      }
    }
  },
  plugins: []
};

export default config;
