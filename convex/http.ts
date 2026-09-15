import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

// Convex Auth publishes the discovery document and keys used to verify guest tokens.
auth.addHttpRoutes(http);

// Exact auth routes take precedence over the static site's catch-all.
registerStaticRoutes(http, components.staticHosting);

export default http;
