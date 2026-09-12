import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import { GuestGame, LocalGame } from "./persistence/GuestGame";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const client = convexUrl ? new ConvexReactClient(convexUrl) : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {client ? (
      <ConvexAuthProvider client={client}>
        <GuestGame />
      </ConvexAuthProvider>
    ) : (
      <LocalGame />
    )}
  </StrictMode>,
);
