import Fastify from "fastify";
import fs from "node:fs";
import Database from "better-sqlite3";

const {
  DB_PATH = "/data/app.db",
  PORT = "7000",
  HOST = "0.0.0.0",
} = process.env;

const app = Fastify({ 
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  app.log.info(`Received ${signal}, shutting down gracefully...`);
  try {
    if (db) {
      db.close();
      app.log.info('Database connection closed');
    }
    await app.close();
    app.log.info('Server closed');
    process.exit(0);
  } catch (err) {
    app.log.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// --- SQLite ---
let db;
try {
  app.log.info(`Initializing SQLite database at: ${DB_PATH}`);
  
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL"); 
  db.pragma("foreign_keys = ON");
  const result = db.prepare("SELECT sqlite_version() as version").get();
  app.log.info(`SQLite database initialized successfully. SQLite version: ${result.version}`);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  app.log.info(`Found ${tables.length} existing tables: ${tables.map(t => t.name).join(', ') || 'none'}`);
  
} catch (error) {
  app.log.error('Failed to initialize SQLite database:', error.message);
  app.log.error('DB_PATH:', DB_PATH);
  app.log.error('Error details:', error);
  process.exit(1);
}

const deny = (sql) => {
  const s = sql.toLowerCase();
  const banned = ["attach ", "vacuum", "pragma ", "begin ", "commit", "rollback"];
  return !banned.some((k) => s.includes(k));
};

app.get("/healthz", async () => {
  try {
    // Test database connectivity
    db.prepare("SELECT 1").get();
    return { ok: true, status: "healthy", timestamp: new Date().toISOString() };
  } catch (error) {
    throw new Error(`Database connectivity check failed: ${error.message}`);
  }
});


app.post("/query", async (req, reply) => {
  const { sql, params = [] } = req.body ?? {};
  if (!sql || typeof sql !== "string") return reply.code(400).send({ error: "missing sql" });
  if (!deny(sql)) return reply.code(400).send({ error: "statement not allowed" });

  try {
    const isWrite = /^(insert|update|delete|replace|create|drop|alter)/i.test(sql.trim());
    const stmt = db.prepare(sql);
    if (isWrite) {
      const info = Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
      return reply.send({ changes: info.changes ?? 0, lastInsertRowid: info.lastInsertRowid ?? null });
    } else {
      const rows = Array.isArray(params) ? stmt.all(...params) : stmt.all(params);
      return reply.send(rows);
    }
  } catch (e) {
    req.log.error(e);
    return reply.code(400).send({ error: `sqlite error: ${e.message}` });
  }
});

app.listen({ host: HOST, port: Number(PORT) })
  .then(() => app.log.info(`listening on http://${HOST}:${PORT}`))
  .catch((err) => { app.log.error(err); process.exit(1); });
