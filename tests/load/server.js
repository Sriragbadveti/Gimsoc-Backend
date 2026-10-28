// Boots the real MEDCON backend with two test-only stubs:
//  1. outbound email (Brevo/Resend/SMTP) -> no-op, so tests never send mail
//  2. per-IP rate limiter -> disabled, because every load-test request comes from 127.0.0.1
//     (in production each attendee has their own IP, so the limiter wouldn't apply to this traffic)
const path = require("path");
const backend = path.resolve(process.argv[2]);
process.env.MONGO_DB = process.env.MONGO_DB || "mongodb://127.0.0.1:27017/gimsoc_bench?replicaSet=rs0";
process.env.JWT_SECRET = "bench-secret";
process.env.PORT = process.env.PORT || "5055";

const Module = require("module");
const emailPath = require.resolve(path.join(backend, "utils/emailService.js"));
const noop = async () => ({ ok: true });
require.cache[emailPath] = {
  id: emailPath, filename: emailPath, loaded: true,
  exports: { sendTicketConfirmationEmail: noop, sendTicketApprovalEmail: noop, sendTicketRejectionEmail: noop, sendWorkshopConfirmationEmail: noop },
};
const rlf = require(require.resolve("rate-limiter-flexible", { paths: [backend] }));
rlf.RateLimiterMemory.prototype.consume = async () => ({ remainingPoints: 999 });

process.chdir(backend);
require(path.join(backend, "index.js"));
