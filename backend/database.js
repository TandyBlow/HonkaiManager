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
    // 1. 小号表 (accounts) - 新增 goals 字段
    db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        password TEXT,
        goals TEXT, -- 用于存储培养目标关键词, e.g., "识律,乐土,碎片"
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating accounts table', err.message);
      else console.log('Table "accounts" created or already exists.');
    });

    // 2. 任务模板表 (tasks) - 【完全重构】
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT, -- 用于前端展示分组 ('日常', '周常', '活动')
        
        -- 核心规则字段 (JSON格式) --
        schedule_rule TEXT NOT NULL,      -- 调度规则 (活动窗口)
        tracking_mode TEXT NOT NULL,      -- 追踪方式 ('boolean', 'counter', 'round_based_counter')
        tracking_config TEXT NOT NULL,    -- 追踪配置 (目标, 覆盖规则, 轮次规则)
        activation_condition TEXT,        -- 激活条件 (可选)
        consumes_resource TEXT            -- 消耗资源 (可选, 关联资源池)
      )
    `, (err) => {
      if (err) console.error('Error creating tasks table', err.message);
      else console.log('Table "tasks" created or already exists.');
    });

    // 3. 任务状态表 (task_status) - 【重构】
    db.run(`
      CREATE TABLE IF NOT EXISTS task_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        task_id INTEGER NOT NULL,
        period_key TEXT NOT NULL, -- 任务周期的唯一标识
        
        status TEXT NOT NULL DEFAULT 'incomplete', -- 'incomplete', 'completed'
        progress TEXT, -- 存储进度的JSON字符串, e.g., '{"current": 3, "goal": 5}'
        
        FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
        UNIQUE(account_id, task_id, period_key)
      )
    `, (err) => {
      if (err) console.error('Error creating task_status table', err.message);
      else console.log('Table "task_status" created or already exists.');
    });

    // 4. 资源池表 (resource_pools) - 【全新】
    db.run(`
        CREATE TABLE IF NOT EXISTS resource_pools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            resource_name TEXT NOT NULL,
            current_value INTEGER NOT NULL,
            max_value INTEGER NOT NULL,
            reset_rule TEXT NOT NULL, -- 定义重置规则的JSON
            last_reset_period TEXT,   -- 记录上次重置的周期，防止重复重置
            FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
            UNIQUE(account_id, resource_name)
        )
    `, (err) => {
        if (err) console.error('Error creating resource_pools table', err.message);
        else console.log('Table "resource_pools" created or already exists.');
    });
  });
}

module.exports = db;
