<!-- frontend/src/views/HomeView.vue -->
<template>
  <div class="home-view">
    <h1>今日任务看板</h1>
    <p>点击任务可更新状态。计数类任务会提示输入进度。</p>
    
    <button @click="fetchDashboardData" class="btn-secondary refresh-btn">
      <i class="icon-refresh"></i> 刷新列表
    </button>
    
    <div v-if="loading" class="loading">正在加载...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-if="!loading && !error" class="dashboard-grid">
      <!-- 遍历每个小号 -->
      <div v-for="account in dashboardData" :key="account.id" class="card account-card">
        <h3>{{ account.nickname }}</h3>
        
        <div v-if="!account.tasks || account.tasks.length === 0" class="all-done">
          今日无任务
        </div>
        <div v-else-if="areAllTasksDone(account)" class="all-done">
          🎉 今日任务已全部完成!
        </div>
        
        <ul v-else class="task-list">
          <li 
            v-for="task in account.tasks" 
            :key="task.id"
            class="task-item"
            :class="{ 'completed': task.is_completed }"
            @click="handleTaskClick(account, task)"
          >
            <!-- 布尔型任务 -->
            <div v-if="task.tracking_type === 'boolean'" class="task-content">
              <span>{{ task.name }}</span>
            </div>

            <!-- 计数型任务 -->
            <div v-else-if="task.tracking_type === 'counter'" class="task-content counter">
              <div class="counter-info">
                <span>{{ task.name }}</span>
                <span class="progress-text">{{ task.progress }} / {{ task.tracking_goal }}</span>
              </div>
              <progress class="progress-bar" :value="task.progress" :max="task.tracking_goal"></progress>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiClient from '@/api/axios';

const dashboardData = ref([]);
const loading = ref(true);
const error = ref(null);

const fetchDashboardData = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get('/dashboard/tasks');
    dashboardData.value = response.data.data;
  } catch (err) {
    console.error('获取看板数据失败:', err);
    error.value = '无法加载看板数据，请确保后端服务正在运行。';
  } finally {
    loading.value = false;
  }
};

onMounted(fetchDashboardData);

// 统一的任务点击处理器
const handleTaskClick = (account, task) => {
  if (task.tracking_type === 'counter') {
    updateCounterTask(account, task);
  } else {
    updateBooleanTask(account, task);
  }
};

// 更新布尔型任务
const updateBooleanTask = async (account, task) => {
  const newStatus = task.is_completed ? 0 : 1;
  
  // 乐观更新 UI
  task.is_completed = newStatus;

  try {
    await apiClient.post('/task-status/update', {
      account_id: account.id,
      task_id: task.id,
      is_completed: newStatus
    });
  } catch (err) {
    // 失败时回滚 UI
    task.is_completed = !newStatus; 
    console.error('更新布尔任务状态失败:', err);
    alert('操作失败，请刷新后重试。');
  }
};

// 更新计数型任务
const updateCounterTask = async (account, task) => {
  const currentProgress = task.progress || 0;
  const newProgressStr = prompt(`更新【${task.name}】的进度`, currentProgress);

  if (newProgressStr === null) return; // 用户取消

  const newProgress = parseInt(newProgressStr, 10);
  if (isNaN(newProgress) || newProgress < 0) {
    alert('请输入一个有效的非负数字。');
    return;
  }

  const oldProgress = task.progress;
  const oldCompleted = task.is_completed;
  const newCompleted = newProgress >= task.tracking_goal ? 1 : 0;

  // 乐观更新 UI
  task.progress = newProgress;
  task.is_completed = newCompleted;

  try {
    await apiClient.post('/task-status/update', {
      account_id: account.id,
      task_id: task.id,
      progress: newProgress,
      is_completed: newCompleted
    });
  } catch (err) {
    // 失败时回滚 UI
    task.progress = oldProgress;
    task.is_completed = oldCompleted;
    console.error('更新计数任务状态失败:', err);
    alert('操作失败，请刷新后重试。');
  }
};

// 检查账号所有任务是否完成
const areAllTasksDone = (account) => {
  if (!account.tasks || account.tasks.length === 0) {
    return true;
  }
  return account.tasks.every(task => task.is_completed);
};
</script>

<style scoped>
/* 引入一个简单的刷新图标 */
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css');
.icon-refresh::before {
  font-family: FontAwesome;
  content: '\f021';
  margin-right: 0.5rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}
.refresh-btn {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
}
.account-card h3 {
  margin-top: 0;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.8rem;
  color: #2c3e50;
}
.task-list {
  list-style: none;
  padding-left: 0;
  margin-top: 1rem;
}
.task-item {
  padding: 0.8rem;
  margin-bottom: 0.8rem;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  border: 1px solid #e9ecef;
  background-color: #fff;
}
.task-item:hover {
  border-color: #42b983;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.05);
}
.task-item.completed {
  background-color: #f8f9fa;
  border-color: #e9ecef;
}
.task-item.completed .task-content span {
  text-decoration: line-through;
  color: #999;
}
.task-content.counter {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.counter-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
}
.progress-text {
  font-size: 0.9rem;
  color: #3498db;
  font-weight: bold;
}
.task-item.completed .progress-text {
  color: #27ae60;
}
.progress-bar {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  -webkit-appearance: none;
  appearance: none;
}
.progress-bar::-webkit-progress-bar {
  background-color: #e9ecef;
  border-radius: 4px;
}
.progress-bar::-webkit-progress-value {
  background-color: #3498db;
  border-radius: 4px;
  transition: width 0.3s ease;
}
.task-item.completed .progress-bar::-webkit-progress-value {
  background-color: #27ae60;
}
.all-done {
  text-align: center;
  padding: 2rem 0;
  color: #27ae60;
  font-weight: bold;
  font-size: 1.1rem;
}
.loading {
  text-align: center;
  padding: 2rem;
  font-size: 1.2rem;
}
.error-message {
  color: #e74c3c;
  text-align: center;
  padding: 1rem;
  background-color: #fdd;
  border-radius: 5px;
}
</style>
