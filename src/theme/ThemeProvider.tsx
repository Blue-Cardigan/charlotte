import { useEffect } from "react";
import type { PropsWithChildren } from "react";
import type { Brand } from "../../shared/contracts";

interface ThemeProviderProps extends PropsWithChildren {
  brand: Brand | null;
}

export function ThemeProvider({ brand, children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    if (!brand) {
      root.removeAttribute("data-brand");
      return;
    }

    root.setAttribute("data-brand", brand.slug);
    root.style.setProperty("--brand-primary", brand.color_primary);
    root.style.setProperty("--brand-secondary", brand.color_secondary ?? brand.color_primary);
    root.style.setProperty("--brand-accent", brand.color_accent);
    root.style.setProperty("--brand-background", "#f3f3ed");
    root.style.setProperty("--brand-surface", "#f3f3ed");
  }, [brand]);

  return <>{children}</>;
}
