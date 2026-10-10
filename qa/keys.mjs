// Genera claves JWT HS256 DESCARTABLES para el stack local (secreto de QA, sin relacion con ningun proyecto real).
import { createHmac } from "node:crypto";
export const QA_JWT_SECRET = process.env.QA_JWT_SECRET || "local-qa-only-secret-0123456789abcdef0123456789";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function signJwt(payload, secret = QA_JWT_SECRET) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", secret).update(head + "." + body).digest("base64url");
  return `${head}.${body}.${sig}`;
}
const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
export const anonKey = () => signJwt({ iss: "irontrack-qa-local", role: "anon", exp });
export const serviceKey = () => signJwt({ iss: "irontrack-qa-local", role: "service_role", exp });
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({ anon: anonKey(), service_role: serviceKey() }));
}
