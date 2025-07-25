// backend/index.js

const express = require('express');
const cors = require('cors');
const db = require('./database.js');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// =================================================================
// 日期与规则计算辅助函数 (新核心)
// =================================================================

/**
 * 根据当前时间获取任务日期 (每日4点刷新)
 * @param {Date} date - The date object to calculate from.
 * @returns {string} 'YYYY-MM-DD' 格式的日期字符串
 */
function getTaskDate(date = new Date()) {
  const d = new Date(date);
  d.setHours(d.getHours() - 4); // 减去4小时
  return d.toISOString().split('T')[0];
}

/**
 * 获取日期的周信息 (ISO 8601 标准: 周一为一周的开始)
 * @param {Date} date
 * @returns {{year: number, week: number}}
 */
function getWeekInfo(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // 将 d 设为当周的周四，周数计算更稳定
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // 年初的周四
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // 计算周数
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week: weekNo };
}

/**
 * 【规则引擎核心】根据任务规则和当前日期，计算任务的周期标识 (Period Key)
 * @param {object} task - 任务模板对象
 * @param {Date} now - 当前时间
 * @returns {string|null} - 如果任务今天激活，返回 Period Key；否则返回 null
 */
function getPeriodKey(task, now) {
    const config = task.schedule_config ? JSON.parse(task.schedule_config) : {};
    const { year, week } = getWeekInfo(now);
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=周一, 7=周日

    switch (task.schedule_type) {
        case 'daily':
            return getTaskDate(now);

        case 'simple_weekly': // 例如：记忆战场 (周二4点 ~ 下周一4点)
            const resetDay = config.reset_day_of_week || 1; // 默认为周一
            const resetHour = config.reset_hour || 4;
            
            const weekStartDate = new Date(now);
            // 计算本周重置点的具体时间
            const daysUntilReset = resetDay - (weekStartDate.getDay() || 7);
            weekStartDate.setDate(weekStartDate.getDate() + daysUntilReset);
            weekStartDate.setHours(resetHour, 0, 0, 0);

            if (now < weekStartDate) {
                // 如果当前时间早于本周的重置点，说明属于上一周的周期
                const lastWeek = new Date(now);
                lastWeek.setDate(lastWeek.getDate() - 7);
                const { year: lastYear, week: lastWeekNum } = getWeekInfo(lastWeek);
                return `${lastYear}-W${lastWeekNum}`;
            }
            return `${year}-W${week}`;

        case 'multi_period': // 例如：深渊 (一周两期)
            for (let i = 0; i < config.periods.length; i++) {
                const period = config.periods[i];
                // 构建开始和结束时间
                const start = new Date(now);
                start.setDate(start.getDate() - (dayOfWeek - period.start.day));
                start.setHours(period.start.hour, 0, 0, 0);

                const end = new Date(now);
                end.setDate(end.getDate() - (dayOfWeek - period.end.day));
                end.setHours(period.end.hour, 0, 0, 0);
                
                if (now >= start && now <= end) {
                    return `${year}-W${week}-${i + 1}`; // 返回 'YYYY-Www-1' 或 'YYYY-Www-2'
                }
            }
            return null; // 不在任何一期内

        default:
            return null;
    }
}


// =================================================================
// 小号 (Accounts) API - 保持不变
// =================================================================
// GET: 获取所有小号列表
app.get('/api/accounts', (req, res) => {
  const sql = "SELECT id, nickname, username, created_at FROM accounts ORDER BY created_at DESC";
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ "error": err.message });
    res.json({ "message": "success", "data": rows });
  });
});
// POST: 添加一个新的小号
app.post('/api/accounts', (req, res) => {
  const { nickname, username, password } = req.body;
  if (!nickname || !username) return res.status(400).json({ "error": "昵称和账号是必填项" });
  const sql = `INSERT INTO accounts (nickname, username, password) VALUES (?, ?, ?)`;
  db.run(sql, [nickname, username, password], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) return res.status(400).json({ "error": "该昵称已存在" });
      return res.status(500).json({ "error": err.message });
    }
    res.status(201).json({ "message": "success", "data": { id: this.lastID, nickname, username } });
  });
});
// DELETE: 删除一个小号
app.delete('/api/accounts/:id', (req, res) => {
  db.run('DELETE FROM accounts WHERE id = ?', req.params.id, function(err) {
    if (err) return res.status(500).json({ "error": err.message });
    if (this.changes === 0) return res.status(404).json({ "error": "找不到该ID的小号" });
    res.json({ "message": `小号 ${req.params.id} 已删除`, "changes": this.changes });
  });
});


// =================================================================
// 任务模板 (Tasks) API - 【重大修改】
// =================================================================
// GET: 获取所有任务模板
app.get('/api/tasks', (req, res) => {
    db.all("SELECT * FROM tasks", [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json({ "message": "success", "data": rows });
    });
});
// POST: 添加一个新的任务模板
app.post('/api/tasks', (req, res) => {
    const { name, type, schedule_type, schedule_config, tracking_type, tracking_goal } = req.body;
    if (!name || !type || !schedule_type) {
        return res.status(400).json({ "error": "name, type, schedule_type 是必填项" });
    }
    // 简单的验证
    try {
        if (schedule_config) JSON.parse(schedule_config);
    } catch(e) {
        return res.status(400).json({ "error": "schedule_config 必须是合法的 JSON 字符串" });
    }

    const sql = `INSERT INTO tasks (name, type, schedule_type, schedule_config, tracking_type, tracking_goal) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [name, type, schedule_type, schedule_config, tracking_type, tracking_goal];
    
    db.run(sql, params, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) return res.status(400).json({ "error": "该任务名称已存在" });
            return res.status(500).json({ "error": err.message });
        }
        res.status(201).json({ "message": "success", "data": { id: this.lastID, ...req.body } });
    });
});
// DELETE: 删除一个任务模板
app.delete('/api/tasks/:id', (req, res) => {
    db.run('DELETE FROM tasks WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ "error": err.message });
        if (this.changes === 0) return res.status(404).json({ "error": "找不到该ID的任务模板" });
        res.json({ "message": `任务模板 ${req.params.id} 已删除`, "changes": this.changes });
    });
});


// =================================================================
// 核心功能 API (Dashboard & Task Status) - 【全新重构】
// =================================================================

// GET: 获取主页看板数据 (动态计算当天所有任务)
app.get('/api/dashboard/tasks', async (req, res) => {
    try {
        const now = new Date();

        // 1. 并行获取所有小号和所有任务模板
        const [accounts, taskTemplates] = await Promise.all([
            new Promise((resolve, reject) => db.all("SELECT id, nickname FROM accounts", [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => db.all("SELECT * FROM tasks", [], (err, rows) => err ? reject(err) : resolve(rows)))
        ]);
        
        if (accounts.length === 0) {
            return res.json({ "message": "success", "data": [] });
        }

        // 2. 计算今天所有“激活”的任务及其 Period Keys
        const activeTasks = taskTemplates.map(task => ({
            ...task,
            period_key: getPeriodKey(task, now)
        })).filter(task => task.period_key !== null);

        if (activeTasks.length === 0) {
             // 如果今天没任务，直接返回空任务列表的小号数据
            const dashboardData = accounts.map(acc => ({ ...acc, tasks: [] }));
            return res.json({ "message": "success", "data": dashboardData });
        }

        // 3. 一次性获取所有小号在所有激活任务上的状态
        const periodKeys = activeTasks.map(t => t.period_key);
        const placeholders = periodKeys.map(() => '?').join(',');
        const sql = `SELECT * FROM task_status WHERE period_key IN (${placeholders})`;
        
        const statuses = await new Promise((resolve, reject) => {
            db.all(sql, periodKeys, (err, rows) => err ? reject(err) : resolve(rows));
        });

        // 4. 构建一个快速查找状态的 Map: 'account_id-task_id' -> status
        const statusMap = new Map();
        statuses.forEach(s => {
            statusMap.set(`${s.account_id}-${s.task_id}`, s);
        });

        // 5. 组合最终数据
        const dashboardData = accounts.map(account => {
            const tasksForAccount = activeTasks.map(task => {
                const status = statusMap.get(`${account.id}-${task.id}`);
                return {
                    ...task, // 包含任务模板所有信息
                    is_completed: status ? status.is_completed : 0,
                    progress: status ? status.progress : 0,
                };
            });

            return {
                ...account,
                tasks: tasksForAccount
            };
        });

        res.json({ "message": "success", "data": dashboardData });
    } catch (err) {
        console.error("Dashboard Error:", err);
        res.status(500).json({ "error": err.message });
    }
});

// POST: 更新任务完成状态 (核心交互)
app.post('/api/task-status/update', (req, res) => {
    const { account_id, task_id, is_completed, progress } = req.body;
    if (account_id === undefined || task_id === undefined || is_completed === undefined) {
        return res.status(400).json({ "error": "缺少必要参数" });
    }

    // 1. 获取任务模板以计算 Period Key
    db.get("SELECT * FROM tasks WHERE id = ?", [task_id], (err, task) => {
        if (err) return res.status(500).json({ "error": err.message });
        if (!task) return res.status(404).json({ "error": "找不到该任务" });

        // 2. 计算 Period Key
        const period_key = getPeriodKey(task, new Date());
        if (!period_key) {
            return res.status(400).json({ "error": "该任务当前不处于激活周期，无法更新" });
        }

        // 3. 使用 UPSERT 逻辑更新或插入状态
        const upsertSql = `
            INSERT INTO task_status (account_id, task_id, period_key, is_completed, progress) 
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(account_id, task_id, period_key) 
            DO UPDATE SET is_completed = excluded.is_completed, progress = excluded.progress;
        `;
        // 注意: progress || 0 确保即使前端不传 progress，数据库也会存入 0 而不是 null
        db.run(upsertSql, [account_id, task_id, period_key, is_completed, progress || 0], function(err) {
            if (err) {
                return res.status(500).json({ "error": `Upsert failed: ${err.message}` });
            }
            res.json({ "message": "任务状态已更新" });
        });
    });
});


app.get('/', (req, res) => {
  res.send('欢迎来到崩坏3小号管理器后端！(V2 - 规则引擎版)');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
