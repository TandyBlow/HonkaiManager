// backend/database.js

const sqlite3 = require('sqlite3').verbose();
const DB_PATH = './honkai_manager.db';

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    createTables();
  }
});

function createTables() {
  db.serialize(() => {
    // 1. 小号表 (accounts) - 保持不变
    db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating accounts table', err.message);
      else console.log('Table "accounts" created or already exists.');
    });

    // 2. 任务模板表 (tasks) - 【重大修改】
    // 注意：如果你已经有数据，直接修改表结构会比较复杂。
    // 在开发阶段，最简单的方法是删除旧的 honkai_manager.db 文件，让程序重新生成。
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK(type IN ('daily', 'weekly', 'version')),
        
        -- 新增字段，用于规则引擎 --
        schedule_type TEXT NOT NULL, -- 规则类型: 'daily', 'simple_weekly', 'multi_period'
        schedule_config TEXT,      -- 规则配置 (JSON 字符串)
        tracking_type TEXT NOT NULL DEFAULT 'boolean', -- 追踪方式: 'boolean', 'counter'
        tracking_goal INTEGER DEFAULT 1                -- 计数器任务的目标值
      )
    `, (err) => {
      if (err) {
        console.error('Error creating tasks table', err.message);
      } else {
        console.log('Table "tasks" created or already exists.');
      }
    });

    // 3. 任务状态表 (task_status) - 【重大修改】
    db.run(`
      CREATE TABLE IF NOT EXISTS task_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        task_id INTEGER NOT NULL,
        
        -- 'task_date' 被 'period_key' 替换 --
        period_key TEXT NOT NULL, -- 任务周期的唯一标识 (如 '2023-10-26' 或 '2023-W43-1')
        
        is_completed INTEGER NOT NULL DEFAULT 0,
        progress INTEGER DEFAULT 0, -- 新增：用于 'counter' 类型的任务
        
        FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
        
        -- UNIQUE 约束更新 --
        UNIQUE(account_id, task_id, period_key)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating task_status table', err.message);
      } else {
        console.log('Table "task_status" created or already exists.');
      }
    });
  });
}

module.exports = db;
