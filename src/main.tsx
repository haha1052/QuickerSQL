import React from "react";
import ReactDOM from "react-dom/client";
import AppWrapper from "./AppWrapper";
import "./styles/theme.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
);
