import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./styles.css";
import "./mobile-pwa.css";
import "./mobile-theme-fixes.css";
import "./mobile-v36-polish.css";
import "./push-notifications.css";
import "./notification-center.css";
import "./notification-inbox.css";
import "./robo-advisor.css";
import "./cirrus-redesign.css";
import { registerAlphaServiceWorker } from "./lib/pwa";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <SettingsProvider>
              <App />
            </SettingsProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

registerAlphaServiceWorker();
