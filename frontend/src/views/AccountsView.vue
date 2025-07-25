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
// 响应式状态
const accounts = ref([]);
const isEditing = ref(false);
const errorMessage = ref('');
const form = ref({
  id: null,
  nickname: '',
  username: '',
  password: ''
});
// 获取所有小号
const fetchAccounts = async () => {
  try {
    const response = await apiClient.get('/accounts');
    accounts.value = response.data.data;
  } catch (error) {
    console.error('获取小号列表失败:', error);
    errorMessage.value = '无法加载小号列表。';
  }
};
// 组件挂载时获取数据
onMounted(fetchAccounts);
// 重置表单
const resetForm = () => {
  isEditing.value = false;
  form.value = { id: null, nickname: '', username: '', password: '' };
  errorMessage.value = '';
};
// 添加新小号
const addAccount = async () => {
  try {
    const payload = {
      nickname: form.value.nickname,
      username: form.value.username,
      password: form.value.password || null
    };
    await apiClient.post('/accounts', payload);
    resetForm();
    await fetchAccounts(); // 重新获取列表
  } catch (error) {
    console.error('添加小号失败:', error);
    errorMessage.value = error.response?.data?.error || '添加失败，请检查输入。';
  }
};
// 更新小号信息
const updateAccount = async () => {
  try {
    const payload = {
      nickname: form.value.nickname,
      username: form.value.username,
      password: form.value.password || undefined // 如果密码为空则不更新
    };
    await apiClient.put(`/accounts/${form.value.id}`, payload);
    resetForm();
    await fetchAccounts(); // 重新获取列表
  } catch (error) {
    console.error('更新小号失败:', error);
    errorMessage.value = error.response?.data?.error || '更新失败，请重试。';
  }
};
// 删除小号
const deleteAccount = async (id) => {
  if (confirm('确定要删除这个小号吗？所有相关数据（目标、任务状态）都将被删除。')) {
    try {
      await apiClient.delete(`/accounts/${id}`);
      await fetchAccounts(); // 重新获取列表
    } catch (error) {
      console.error('删除小号失败:', error);
      errorMessage.value = '删除失败，请重试。';
    }
  }
};
// 点击“修改”按钮，将小号信息填入表单
const startEdit = (account) => {
  isEditing.value = true;
  form.value = { ...account, password: '' }; // 不显示旧密码
  window.scrollTo(0, 0); // 滚动到页面顶部方便修改
};
// 取消修改
const cancelEdit = () => {
  resetForm();
};
// 表单提交处理
const handleFormSubmit = () => {
  if (isEditing.value) {
    updateAccount();
  } else {
    addAccount();
  }
};
</script>
<style scoped>
.form-group {
  margin-bottom: 1rem;
}
.form-group label {
  display: block;
  margin-bottom: 0.5rem;
}
.form-actions {
  display: flex;
  gap: 1rem;
}
.error-message {
    color: #e74c3c;
    margin-top: 1rem;
}
.account-list {
  list-style: none;
  padding: 0;
}
.account-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}
.account-item:last-child {
  border-bottom: none;
}
.account-actions {
  display: flex;
  gap: 0.5rem;
}
</style>