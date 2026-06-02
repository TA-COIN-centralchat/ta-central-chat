import { createContext, useContext, useState } from "react";

const LayoutContext = createContext(null);

export const LayoutProvider = ({ children }) => {
  const [title, setTitle] = useState("Dashboard");
  const [description, setDescription] = useState("");

  return (
    <LayoutContext.Provider
      value={{ title, setTitle, description, setDescription }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
};
