"use client";
import { useEffect, useState } from "react";
import { getProviders } from "next-auth/react";

export function useSignInProviders() {
  const [options, setOptions] = useState<{ loading: boolean; failed: boolean; google: boolean; devStudent: boolean }>({ loading: true, failed: false, google: false, devStudent: false });
  useEffect(() => {
    let active = true;
    void getProviders().then(providers => {
      if (active) setOptions({ loading: false, failed: !providers, google: !!providers?.google, devStudent: !!providers?.["dev-student"] });
    }).catch(() => { if (active) setOptions({ loading: false, failed: true, google: false, devStudent: false }); });
    return () => { active = false; };
  }, []);
  return options;
}
