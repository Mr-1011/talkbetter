import { createHmac } from "node:crypto";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

// Short-lived public-scope token for the browser. It can only create web calls.
// https://docs.vapi.ai/customization/jwt-authentication
export async function POST() {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    orgId: process.env.VAPI_ORG_ID,
    token: { tag: "public" },
    iat: now,
    exp: now + 600,
  })}`;
  const sig = createHmac("sha256", process.env.VAPI_PRIVATE_KEY!).update(body).digest("base64url");
  return Response.json({ token: `${body}.${sig}` });
}
