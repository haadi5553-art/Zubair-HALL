/**
 * Password reset tool for Zubair Hall Mess Manager.
 * Restores the login password to the initial one (the password whose
 * salted PBKDF2 hash is stored in MESS_PASSWORD_HASH in the .env file).
 *
 * Usage:  npm run reset-password
 */
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:../db/custom.db";

const FALLBACK_HASH =
  "pbkdf2_sha256$310000$wRuiOsnyZo/lInqyBQBtJA==$/sroquUSh3FBLcBxZw9tJklZUTj3K11GIvpwakPwPq8=";

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    const hash = process.env.MESS_PASSWORD_HASH || FALLBACK_HASH;
    await db.credential.upsert({
      where: { id: "admin" },
      create: { id: "admin", passwordHash: hash, failedAttempts: 0, lockedUntil: null },
      update: { passwordHash: hash, failedAttempts: 0, lockedUntil: null },
    });
    console.log("");
    console.log("✅ Password has been reset to the initial password.");
    console.log("   Log in with it, then change it in Settings > Change password.");
    console.log("");
  } catch (e) {
    console.error("❌ Could not reset the password:", e.message);
    console.error("   Make sure you ran \"npm install\" and \"npm run build\" in this folder first.");
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();
