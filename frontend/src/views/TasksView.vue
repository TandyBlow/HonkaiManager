<!-- frontend/src/views/TasksView.vue -->
<template>
    <div class="tasks-view">
        <h1>任务模板管理</h1>
        
        <!-- 添加/修改任务模板的表单 -->
        <div class="card">
            <h2>添加新任务模板</h2>
            <form @submit.prevent="addTask">
                <!-- 基础信息 -->
                <div class="form-group">
                    <label for="task-name">任务名称</label>
                    <input id="task-name" type="text" v-model="newTask.name" placeholder="如：深渊挑战" required>
                </div>
                <div class="form-group">
                    <label for="task-type">任务大类</label>
                    <select id="task-type" v-model="newTask.type" required>
                        <option disabled value="">选择任务大类</option>
                        <option value="daily">日常任务</option>
                        <option value="weekly">周常任务</option>
                        <option value="version">版本/活动任务</option>
                    </select>
                </div>

                <hr class="form-divider">

                <!-- 规则配置 -->
                <div class="form-group">
                    <label for="schedule-type">调度规则类型</label>
                    <select id="schedule-type" v-model="newTask.schedule_type" required>
                        <option disabled value="">选择调度规则</option>
                        <option value="daily">每日刷新</option>
                        <option value="simple_weekly">简单周常 (按周重置)</option>
                        <option value="multi_period">复杂周常 (周内多阶段)</option>
                    </select>
                </div>

                <!-- 动态显示的配置输入和帮助信息 -->
                <div v-if="newTask.schedule_type" class="form-group">
                    <label for="schedule-config">调度规则配置 (JSON格式)</label>
                    <div v-if="newTask.schedule_type === 'simple_weekly'" class="config-helper">
                        <p><strong>示例 (记忆战场):</strong> 周二凌晨4点重置。</p>
                        <pre>{"reset_day_of_week": 2, "reset_hour": 4}</pre>
                    </div>
                    <div v-if="newTask.schedule_type === 'multi_period'" class="config-helper">
                        <p><strong>示例 (深渊):</strong> 周一15:00-周三22:00, 周五15:00-周日22:00。</p>
                        <pre>{"periods": [{"start": {"day": 1, "hour": 15}, "end": {"day": 3, "hour": 22}}, {"start": {"day": 5, "hour": 15}, "end": {"day": 7, "hour": 22}}]}</pre>
                    </div>
                    <textarea id="schedule-config" v-model="newTask.schedule_config" rows="5" placeholder="根据上面的示例填写JSON，或留空"></textarea>
                </div>
                
                <hr class="form-divider">

                <!-- 追踪方式 -->
                <div class="form-group">
                    <label for="tracking-type">任务追踪方式</label>
                    <select id="tracking-type" v-model="newTask.tracking_type">
                        <option value="boolean">布尔型 (完成/未完成)</option>
                        <option value="counter">计数型 (记录进度)</option>
                    </select>
                </div>
                <div v-if="newTask.tracking_type === 'counter'" class="form-group">
                    <label for="tracking-goal">计数目标</label>
                    <input id="tracking-goal" type="number" v-model.number="newTask.tracking_goal" min="1">
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn-primary">添加任务</button>
                </div>
                <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
            </form>
        </div>

        <!-- 任务列表 -->
        <div class="card">
            <h2>任务列表</h2>
            <div v-for="(group, type) in groupedTasks" :key="type">
                <h3>{{ taskTypeMap[type] }}</h3>
                <ul class="task-list">
                    <li v-for="task in group" :key="task.id">
                        <div class="task-info">
                            <strong>{{ task.name }}</strong>
                            <span class="task-meta">({{ task.schedule_type }})</span>
                        </div>
                        <button @click="deleteTask(task.id)" class="btn-danger btn-small">删除</button>
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import apiClient from '@/api/axios';

const tasks = ref([]);
const errorMessage = ref('');
const newTask = ref({
    name: '',
    type: '',
    schedule_type: '',
    schedule_config: '',
    tracking_type: 'boolean',
    tracking_goal: 1
});

const taskTypeMap = {
    daily: '日常任务',
    weekly: '周常任务',
    version: '版本/活动任务'
};

const fetchTasks = async () => {
    try {
        const response = await apiClient.get('/tasks');
        tasks.value = response.data.data;
    } catch (error) {
        console.error("获取任务模板失败:", error);
        errorMessage.value = '无法加载任务列表。';
    }
};

onMounted(fetchTasks);

const resetForm = () => {
    newTask.value = {
        name: '',
        type: '',
        schedule_type: '',
        schedule_config: '',
        tracking_type: 'boolean',
        tracking_goal: 1
    };
    errorMessage.value = '';
};

const addTask = async () => {
    errorMessage.value = '';
    try {
        // 准备要发送的数据
        const payload = { ...newTask.value };
        // 如果 schedule_config 为空，则发送 null
        if (!payload.schedule_config) {
            payload.schedule_config = null;
        }
        // 如果不是计数器类型，则不发送 goal
        if (payload.tracking_type !== 'counter') {
            delete payload.tracking_goal;
        }

        await apiClient.post('/tasks', payload);
        resetForm();
        await fetchTasks();
    } catch (error) {
        errorMessage.value = error.response?.data?.error || '添加失败，请检查输入。';
        console.error("添加任务模板失败:", error);
    }
};

const deleteTask = async (taskId) => {
    if (confirm('确定要删除这个任务模板吗？所有相关的历史状态记录也将被删除。')) {
        try {
            await apiClient.delete(`/tasks/${taskId}`);
            await fetchTasks();
        } catch (error) {
            errorMessage.value = error.response?.data?.error || '删除失败';
            console.error("删除任务模板失败:", error);
        }
    }
};

const groupedTasks = computed(() => {
    return tasks.value.reduce((acc, task) => {
        (acc[task.type] = acc[task.type] || []).push(task);
        return acc;
    }, {});
});
</script>

<style scoped>
.form-group {
    margin-bottom: 1.5rem;
}
.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
}
.form-divider {
    border: none;
    border-top: 1px solid #eee;
    margin: 2rem 0;
}
.form-actions {
    margin-top: 1.5rem;
}
.config-helper {
    background-color: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
}
.config-helper pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    color: #c0392b;
    background-color: #fff;
    padding: 0.5rem;
    border-radius: 4px;
}
input, select, textarea {
    width: 100%;
    padding: 0.6rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
}
.task-list {
    list-style: none;
    padding: 0;
}
.task-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem;
    background-color: #f9f9f9;
    border-radius: 4px;
    margin-bottom: 0.5rem;
}
.task-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.task-meta {
    font-size: 0.8rem;
    color: #777;
    background-color: #e9ecef;
    padding: 0.2rem 0.5rem;
    border-radius: 10px;
}
.error-message {
    color: #e74c3c;
    margin-top: 1rem;
}
.btn-small {
    padding: 0.3rem 0.8rem;
    font-size: 0.8rem;
}
</style>
