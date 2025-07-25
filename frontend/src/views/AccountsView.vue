<!-- frontend/src/views/AccountsView.vue -->
<template>
  <div class="accounts-view">
    <h1>小号管理</h1>
    <!-- 添加/修改小号的表单 -->
    <div class="card">
      <h2>{{ isEditing ? '修改小号' : '添加新小号' }}</h2>
      <form @submit.prevent="handleFormSubmit">
        <div class="form-group">
          <label for="nickname">昵称:</label>
          <input id="nickname" type="text" v-model="form.nickname" required>
        </div>
        <div class="form-group">
          <label for="username">游戏账号:</label>
          <input id="username" type="text" v-model="form.username" required>
        </div>
        <div class="form-group">
          <label for="password">游戏密码 (可选):</label>
          <input id="password" type="password" v-model="form.password">
        </div>
        <!-- 新增：培养目标 -->
        <div class="form-group">
          <label for="goals">培养目标 (用英文逗号分隔):</label>
          <input id="goals" type="text" v-model="form.goals" placeholder="例如: 识律,乐土,碎片">
          <small>这些关键词将用于触发特殊任务，如“保税仓库”。</small>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary">{{ isEditing ? '确认修改' : '添加' }}</button>
          <button type="button" v-if="isEditing" @click="cancelEdit">取消修改</button>
        </div>
      </form>
       <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>
    <!-- 小号列表 -->
    <div class="card">
      <h2>小号列表</h2>
      <ul class="account-list">
        <li v-for="account in accounts" :key="account.id" class="account-item">
          <div class="account-info">
            <strong>{{ account.nickname }}</strong>
            <span> (账号: {{ account.username }})</span>
            <div v-if="account.goals" class="goals-display">
              目标: {{ account.goals }}
            </div>
          </div>
          <div class="account-actions">
            <button @click="startEdit(account)" class="btn-secondary">修改</button>
            <button @click="deleteAccount(account.id)" class="btn-danger">删除</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiClient from '@/api/axios';

const accounts = ref([]);
const isEditing = ref(false);
const errorMessage = ref('');
const form = ref({
  id: null,
  nickname: '',
  username: '',
  password: '',
  goals: '' // 新增
});

const fetchAccounts = async () => {
  try {
    const response = await apiClient.get('/accounts');
    accounts.value = response.data.data;
  } catch (error) {
    errorMessage.value = '无法加载小号列表。';
  }
};

onMounted(fetchAccounts);

const resetForm = () => {
  isEditing.value = false;
  form.value = { id: null, nickname: '', username: '', password: '', goals: '' };
  errorMessage.value = '';
};

const handleFormSubmit = async () => {
  errorMessage.value = '';
  const payload = {
    nickname: form.value.nickname,
    username: form.value.username,
    password: form.value.password || undefined,
    goals: form.value.goals || null
  };

  try {
    if (isEditing.value) {
      await apiClient.put(`/accounts/${form.value.id}`, payload);
    } else {
      await apiClient.post('/accounts', payload);
    }
    resetForm();
    await fetchAccounts();
  } catch (error) {
    errorMessage.value = error.response?.data?.error || '操作失败，请检查输入。';
  }
};

const deleteAccount = async (id) => {
  if (confirm('确定要删除这个小号吗？')) {
    try {
      await apiClient.delete(`/accounts/${id}`);
      await fetchAccounts();
    } catch (error) {
      errorMessage.value = '删除失败，请重试。';
    }
  }
};

const startEdit = (account) => {
  isEditing.value = true;
  form.value = { ...account, password: '' };
  window.scrollTo(0, 0);
};

const cancelEdit = () => {
  resetForm();
};
</script>

<style scoped>
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; }
.form-group small { color: #777; font-size: 0.8rem; }
.form-actions { display: flex; gap: 1rem; }
.error-message { color: #e74c3c; margin-top: 1rem; }
.account-list { list-style: none; padding: 0; }
.account-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid #eee; }
.account-item:last-child { border-bottom: none; }
.account-info { display: flex; flex-direction: column; gap: 0.25rem; }
.goals-display { font-size: 0.85rem; color: #3498db; background-color: #ecf0f1; padding: 0.2rem 0.5rem; border-radius: 10px; align-self: flex-start; }
.account-actions { display: flex; gap: 0.5rem; }
</style>
