import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const sqls = [
  // Add slackWebhookUrl to users
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT",
  // Add userId to metaSyncSchedule
  "ALTER TABLE meta_sync_schedule ADD COLUMN IF NOT EXISTS user_id INT",
  // Create decay_reports table
  `CREATE TABLE IF NOT EXISTS decay_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    account_id VARCHAR(64) NOT NULL,
    account_name TEXT,
    campaign_ids TEXT,
    date_from VARCHAR(16) NOT NULL,
    date_to VARCHAR(16) NOT NULL,
    report_type ENUM('manual','auto') NOT NULL,
    signal_count INT NOT NULL DEFAULT 0,
    probable_count INT NOT NULL DEFAULT 0,
    possible_count INT NOT NULL DEFAULT 0,
    emerging_count INT NOT NULL DEFAULT 0,
    report_json MEDIUMTEXT NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX dr_user_idx (user_id),
    INDEX dr_user_account_idx (user_id, account_id),
    INDEX dr_created_at_idx (created_at)
  )`,
];

for (const sql of sqls) {
  try {
    await conn.execute(sql);
    console.log("OK:", sql.slice(0, 70));
  } catch (e) {
    console.error("ERR:", e.message, "|", sql.slice(0, 70));
  }
}

await conn.end();
console.log("Done.");
