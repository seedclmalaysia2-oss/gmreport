// One-shot Supabase password tester.
//
//   node scripts/test-db.cjs <password>
//
// Connects to the Supabase pooler with the given password and prints OK or the
// real Postgres error code. Lets you confirm the password without sharing it
// in chat: type it on the command line, see the result, move on.
const { Client } = require("pg");

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/test-db.cjs <password>");
  process.exit(1);
}

const client = new Client({
  host: "aws-1-ap-northeast-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.ryiosvlwepmwvredeunz",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    await client.connect();
    const r = await client.query("select current_user, version()");
    console.log("OK — logged in as", r.rows[0].current_user);
    console.log("Postgres:", String(r.rows[0].version).slice(0, 60));
    await client.end();
    process.exit(0);
  } catch (e) {
    console.error("FAIL — code=" + (e.code || "?"), e.message);
    process.exit(2);
  }
})();
