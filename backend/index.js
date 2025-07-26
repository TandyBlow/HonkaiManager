// backend/index.js

const express = require('express');
const cors = require('cors');
const db = require('./database.js');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// =================================================================
// 任务引擎核心 (The New Engine)
// =================================================================

/**
 * 获取任务日期 (每日4点刷新)
 * @param {Date} date
 * @returns {string} 'YYYY-MM-DD'
 */
function getTaskDate(date = new Date()) {
  const d = new Date(date);
  d.setHours(d.getHours() - 4);
  return d.toISOString().split('T')[0];
}

/**
 * 获取ISO周信息 (周一为1, 周日为7)
 * @param {Date} date
 * @returns {{year: number, week: number, day: number}}
 */
function getWeekInfo(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    return { year: d.getUTCFullYear(), week: weekNo, day: dayOfWeek };
}

/**
 * 【引擎核心】根据任务规则和当前时间，计算任务的完整上下文
 * @param {object} task - 任务模板对象
 * @param {object} account - 小号对象
 * @param {Date} now - 当前时间
 * @returns {object|null} - 如果任务激活，返回上下文对象；否则返回 null
 */
function getTaskContext(task, account, now = new Date()) {
    const scheduleRule = JSON.parse(task.schedule_rule);
    const trackingConfig = JSON.parse(task.tracking_config);
    const activationCondition = task.activation_condition ? JSON.parse(task.activation_condition) : null;

    // 1. 检查激活条件
    if (activationCondition) {
        if (activationCondition.type === 'goal_dependency') {
            const accountGoals = account.goals ? account.goals.split(',') : [];
            if (!accountGoals.some(g => g.trim() === activationCondition.contains)) {
                return null; // 不满足激活条件
            }
        }
    }

    // 2. 检查调度规则 (活动窗口)
    const { year, week, day } = getWeekInfo(now);
    let period_key = null;
    let isActive = false;

    switch (scheduleRule.type) {
        case 'daily':
            isActive = true;
            period_key = getTaskDate(now);
            break;

        case 'weekly': {
            const { start, end } = scheduleRule.config;
            const nowMs = now.getTime();

            // 计算本周和上周的活动窗口
            for (let weekOffset = 0; weekOffset >= -7; weekOffset -= 7) {
                const checkDate = new Date(now);
                checkDate.setDate(checkDate.getDate() + weekOffset);
                
                const startDayOffset = start.day - (checkDate.getDay() || 7);
                const endDayOffset = end.day - (checkDate.getDay() || 7) + (end.day < start.day ? 7 : 0);

                const windowStart = new Date(checkDate);
                windowStart.setDate(windowStart.getDate() + startDayOffset);
                windowStart.setHours(start.hour, 0, 0, 0);

                const windowEnd = new Date(checkDate);
                windowEnd.setDate(windowEnd.getDate() + endDayOffset);
                windowEnd.setHours(end.hour, 0, 0, 0);

                if (nowMs >= windowStart.getTime() && nowMs < windowEnd.getTime()) {
                    isActive = true;
                    const { year: wYear, week: wWeek } = getWeekInfo(windowStart);
                    period_key = `${wYear}-W${wWeek}`;
                    break;
                }
            }
            break;
        }

        case 'date_range': {
            const { start, end } = scheduleRule.config;
            const nowMs = now.getTime();
            if (nowMs >= new Date(start).getTime() && nowMs < new Date(end).getTime()) {
                isActive = true;
                period_key = `event-${task.id}`; // 对于长线活动，用任务ID作为周期标识
            }
            break;
        }
    }

    if (!isActive) return null;

    // 3. 计算最终目标 (处理覆盖规则)
    let finalGoal = trackingConfig.goal || 1;
    if (trackingConfig.overrides) {
        const accountGoals = account.goals ? account.goals.split(',') : [];
        for (const override of trackingConfig.overrides) {
            if (override.if_goal_contains && accountGoals.some(g => g.trim() === override.if_goal_contains)) {
                finalGoal = override.new_goal;
                break;
            }
        }
    }

    return {
        ...task,
        period_key,
        final_goal: finalGoal,
    };
}


// =================================================================
// API Endpoints
// =================================================================

// --- 小号管理 (Accounts) ---
app.get('/api/accounts', (req, res) => {
    db.all("SELECT * FROM accounts ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json({ "message": "success", "data": rows });
    });
});

app.post('/api/accounts', (req, res) => {
    const { nickname, username, password, goals } = req.body;
    if (!nickname || !username) return res.status(400).json({ "error": "昵称和账号是必填项" });
    const sql = `INSERT INTO accounts (nickname, username, password, goals) VALUES (?, ?, ?, ?)`;
    db.run(sql, [nickname, username, password, goals], function(err) {
        if (err) return res.status(500).json({ "error": err.message });
        res.status(201).json({ "message": "success", "data": { id: this.lastID, ...req.body } });
    });
});

app.put('/api/accounts/:id', (req, res) => {
    const { nickname, username, password, goals } = req.body;
    const sql = `UPDATE accounts SET nickname = ?, username = ?, password = ?, goals = ? WHERE id = ?`;
    db.run(sql, [nickname, username, password, goals, req.params.id], function(err) {
        if (err) return res.status(500).json({ "error": err.message });
        res.json({ "message": "success" });
    });
});

app.delete('/api/accounts/:id', (req, res) => {
    db.run('DELETE FROM accounts WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ "error": err.message });
        res.json({ "message": `小号 ${req.params.id} 已删除` });
    });
});

// --- 任务模板管理 (Tasks) ---
app.get('/api/tasks', (req, res) => {
    db.all("SELECT * FROM tasks", [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json({ "message": "success", "data": rows });
    });
});

app.post('/api/tasks', (req, res) => {
    const { name, category, schedule_rule, tracking_mode, tracking_config, activation_condition, consumes_resource } = req.body;
    // Basic validation
    try {
        JSON.parse(schedule_rule);
        JSON.parse(tracking_config);
        if(activation_condition) JSON.parse(activation_condition);
    } catch (e) {
        return res.status(400).json({ "error": "规则或配置项必须是合法的JSON字符串" });
    }
    const sql = `INSERT INTO tasks (name, category, schedule_rule, tracking_mode, tracking_config, activation_condition, consumes_resource) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [name, category, schedule_rule, tracking_mode, tracking_config, activation_condition, consumes_resource];
    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ "error": err.message });
        res.status(201).json({ "message": "success", "data": { id: this.lastID, ...req.body } });
    });
});

app.delete('/api/tasks/:id', (req, res) => {
    db.run('DELETE FROM tasks WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ "error": err.message });
        if (this.changes === 0) return res.status(404).json({ "error": "找不到该任务" });
        res.json({ "message": `任务 ${req.params.id} 已删除` });
    });
});

// --- 【全新】资源池模板管理 (Resource Pool Templates) ---
app.get('/api/resource-pool-templates', (req, res) => {
    db.all("SELECT * FROM resource_pool_templates", [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json({ "message": "success", "data": rows });
    });
});
app.post('/api/resource-pool-templates', (req, res) => {
    const { name, max_value, reset_rule } = req.body;
    try {
        JSON.parse(reset_rule);
    } catch (e) {
        return res.status(400).json({ "error": "重置规则必须是合法的JSON字符串" });
    }
    const sql = `INSERT INTO resource_pool_templates (name, max_value, reset_rule) VALUES (?, ?, ?)`;
    db.run(sql, [name, max_value, reset_rule], function(err) {
        if (err) return res.status(500).json({ "error": err.message });
        res.status(201).json({ "message": "success", "data": { id: this.lastID, ...req.body } });
    });
});
app.delete('/api/resource-pool-templates/:id', (req, res) => {
    db.run('DELETE FROM resource_pool_templates WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ "error": err.message });
        if (this.changes === 0) return res.status(404).json({ "error": "找不到该资源池模板" });
        res.json({ "message": `资源池模板 ${req.params.id} 已删除` });
    });
});

// --- 核心功能 API (Dashboard & Task Status) ---

// --- 核心功能 API (Dashboard & Task Status) ---
// 【重构】看板API，加入完整的资源池逻辑
app.get('/api/dashboard/tasks', async (req, res) => {
    try {
        const now = new Date();
        const { year, week } = getWeekInfo(now);
        const todayKey = getTaskDate(now);
        // 1. 获取所有基础数据
        const [accounts, taskTemplates, allStatuses, poolTemplates, accountPools] = await Promise.all([
            new Promise((resolve, reject) => db.all("SELECT * FROM accounts", [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => db.all("SELECT * FROM tasks", [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => db.all("SELECT * FROM task_status", [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => db.all("SELECT * FROM resource_pool_templates", [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => db.all("SELECT * FROM resource_pools", [], (err, rows) => err ? reject(err) : resolve(rows)))
        ]);
        if (accounts.length === 0) return res.json({ "message": "success", "data": [] });
        // 2. 构建快速查找Map
        const statusMap = new Map(allStatuses.map(s => [`${s.account_id}-${s.task_id}-${s.period_key}`, s]));
        const poolTemplateMap = new Map(poolTemplates.map(pt => [pt.name, pt]));
        const accountPoolsMap = new Map(accountPools.map(ap => [`${ap.account_id}-${ap.resource_name}`, ap]));
        // 3. 为每个小号生成看板数据
        const dashboardData = await Promise.all(accounts.map(async (account) => {
            const activePoolsForAccount = {};
            // 3.1 处理和重置资源池
            for (const template of poolTemplates) {
                let poolInstance = accountPoolsMap.get(`${account.id}-${template.name}`);
                const resetRule = JSON.parse(template.reset_rule);
                let currentPeriodKey = '';
                if (resetRule.type === 'weekly') currentPeriodKey = `${year}-W${week}`;
                if (resetRule.type === 'daily') currentPeriodKey = todayKey;
                // 如果池不存在，则为该用户惰性创建
                if (!poolInstance) {
                    poolInstance = {
                        account_id: account.id,
                        resource_name: template.name,
                        current_value: template.max_value,
                        max_value: template.max_value,
                        reset_rule: template.reset_rule,
                        last_reset_period: currentPeriodKey
                    };
                    await new Promise((resolve, reject) => {
                        const sql = `INSERT INTO resource_pools (account_id, resource_name, current_value, max_value, reset_rule, last_reset_period) VALUES (?, ?, ?, ?, ?, ?)`;
                        db.run(sql, [account.id, template.name, template.max_value, template.max_value, template.reset_rule, currentPeriodKey], (err) => err ? reject(err) : resolve());
                    });
                } 
                // 如果池存在且需要重置
                else if (poolInstance.last_reset_period !== currentPeriodKey) {
                    poolInstance.current_value = poolInstance.max_value;
                    poolInstance.last_reset_period = currentPeriodKey;
                    await new Promise((resolve, reject) => {
                        const sql = `UPDATE resource_pools SET current_value = ?, last_reset_period = ? WHERE id = ?`;
                        db.run(sql, [poolInstance.max_value, currentPeriodKey, poolInstance.id], (err) => err ? reject(err) : resolve());
                    });
                }
                activePoolsForAccount[template.name] = poolInstance;
            }
            // 3.2 生成任务列表
            const tasksForAccount = taskTemplates.map(task => {
                const context = getTaskContext(task, account, now);
                if (!context) return null;
                const statusRecord = statusMap.get(`${account.id}-${context.id}-${context.period_key}`);
                const progress = statusRecord ? JSON.parse(statusRecord.progress || '{}') : {};
                const status = statusRecord ? statusRecord.status : 'incomplete';
                return { ...context, status, progress };
            }).filter(Boolean);
            return { ...account, tasks: tasksForAccount, resource_pools: activePoolsForAccount };
        }));
        res.json({ "message": "success", "data": dashboardData });
    } catch (err) {
        console.error("Dashboard Error:", err);
        res.status(500).json({ "error": err.message });
    }
});
// 【重构】任务更新API，加入资源消耗逻辑
app.post('/api/task-status/update', async (req, res) => {
    const { account_id, task_id, new_progress } = req.body;
    
    try {
        const [task, account] = await Promise.all([
            new Promise((resolve, reject) => db.get("SELECT * FROM tasks WHERE id = ?", [task_id], (err, row) => err ? reject(err) : resolve(row))),
            new Promise((resolve, reject) => db.get("SELECT * FROM accounts WHERE id = ?", [account_id], (err, row) => err ? reject(err) : resolve(row)))
        ]);
        if (!task || !account) return res.status(404).json({ "error": "找不到任务或小号" });
        const context = getTaskContext(task, account, new Date());
        if (!context) return res.status(400).json({ "error": "任务当前不处于激活周期" });
        const { period_key, tracking_mode, final_goal, consumes_resource } = context;
        
        // 获取旧进度以计算差值
        const oldStatus = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM task_status WHERE account_id = ? AND task_id = ? AND period_key = ?", [account_id, task_id, period_key], (err, row) => err ? reject(err) : resolve(row));
        });
        const oldProgress = oldStatus && oldStatus.progress ? JSON.parse(oldStatus.progress) : { current: 0 };
        let progressToSave = {};
        let statusToSave = 'incomplete';
        let progressDelta = 0;
        // ... (switch case for tracking_mode remains the same)
        switch (tracking_mode) {
            case 'boolean':
                statusToSave = new_progress.completed ? 'completed' : 'incomplete';
                progressToSave = {};
                progressDelta = (statusToSave === 'completed' && (!oldStatus || oldStatus.status !== 'completed')) ? 1 : 0;
                break;
            case 'counter':
                progressToSave = { current: new_progress.current, goal: final_goal };
                if (progressToSave.current >= final_goal) statusToSave = 'completed';
                progressDelta = new_progress.current - oldProgress.current;
                break;
            // ... other cases
        }
        // 如果任务消耗资源，则更新资源池
        if (consumes_resource && progressDelta > 0) {
            await new Promise((resolve, reject) => {
                const sql = `UPDATE resource_pools SET current_value = current_value - ? WHERE account_id = ? AND resource_name = ?`;
                db.run(sql, [progressDelta, account_id, consumes_resource], (err) => err ? reject(err) : resolve());
            });
        }
        // 使用UPSERT更新任务状态
        const upsertSql = `
            INSERT INTO task_status (account_id, task_id, period_key, status, progress) 
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(account_id, task_id, period_key) 
            DO UPDATE SET status = excluded.status, progress = excluded.progress;
        `;
        
        db.run(upsertSql, [account_id, task_id, period_key, statusToSave, JSON.stringify(progressToSave)], function(err) {
            if (err) return res.status(500).json({ "error": `Upsert failed: ${err.message}` });
            res.json({ "message": "任务状态已更新" });
        });
    } catch (err) {
        console.error("Update task error:", err);
        res.status(500).json({ "error": err.message });
    }
});

app.get('/', (req, res) => {
  res.send('欢迎来到崩坏3小号管理器后端！(V3 - 全新规则引擎版)');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
