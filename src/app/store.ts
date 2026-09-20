import { createContext, useContext } from "react";
import type { Session, Configuration } from "../shared/api";
export const AppContext = createContext<{
  session: Session;
  config: Configuration;
  refresh: () => Promise<void>;
  creationRoute: string;
  requireLogin: () => boolean;
  toast: (s: string) => void;
}>(null!);
export const useApp = () => useContext(AppContext);
