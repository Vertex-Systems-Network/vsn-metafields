import { createContext, useContext } from "react";
import { APP_NAME } from "../product-config";

export const AppNameContext = createContext(APP_NAME);
export const useAppName = () => useContext(AppNameContext);
