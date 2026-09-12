import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Convex Auth publishes the discovery document and keys used to verify guest tokens.
auth.addHttpRoutes(http);

export default http;
