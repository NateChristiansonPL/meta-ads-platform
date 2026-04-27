import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await conn.execute(
    'INSERT IGNORE INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)',
    ['4a8c52ee798114e9eb70468d8fe2fe04765ca959be96dcfb78319189f9c5ff20', Date.now()]
  );
  console.log('Migration record inserted for 0004_purple_mockingbird');
} catch (e) {
  console.error('Error:', e.message);
}
await conn.end();
