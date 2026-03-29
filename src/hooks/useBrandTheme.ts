import { useMemo } from "react";
import type { Brand } from "../../shared/contracts";

export function useBrandTheme(brand: Brand | null) {
  return useMemo(
    () => ({
      personaName: brand?.persona_name ?? "Charlotte",
      welcomeHeading: brand?.welcome_heading ?? "Hey, I'm Charlotte",
      welcomeBody:
        brand?.welcome_body ??
        "I will ask a few quick voice questions and keep things conversational. Tap Okay when you are ready.",
    }),
    [brand],
  );
}
