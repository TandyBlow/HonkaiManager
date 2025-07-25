<!-- frontend/src/views/TasksView.vue -->
<template>
  <div class="tasks-view">
    <h1>任务模板构造器</h1>
    
    <div class="card">
      <h2>添加新任务模板</h2>
      <form @submit.prevent="addTask">
        <!-- 基础信息 -->
        <fieldset>
          <legend>1. 基础信息</legend>
          <div class="form-group">
            <label>任务名称</label>
            <input type="text" v-model="form.name" placeholder="如：量子深渊" required>
          </div>
          <div class="form-group">
            <label>分类 (用于看板分组)</label>
            <input type="text" v-model="form.category" placeholder="如：周常">
          </div>
        </fieldset>

        <!-- 调度规则 -->
        <fieldset>
          <legend>2. 调度规则 (任务何时出现?)</legend>
          <select v-model="form.schedule_rule.type" required>
            <option value="daily">每日</option>
            <option value="weekly">每周 (活动窗口)</option>
            <option value="date_range">固定日期范围</option>
          </select>
          
          <div v-if="form.schedule_rule.type === 'daily'" class="config-box">
            <label>每日刷新时间 (小时)</label>
            <input type="number" v-model.number="form.schedule_rule.config.reset_hour" min="0" max="23">
          </div>
          <div v-if="form.schedule_rule.type === 'weekly'" class="config-box">
            <label>开始于:</label>
            <select v-model.number="form.schedule_rule.config.start.day">
              <!-- FIX: Added :key="d" -->
              <option v-for="d in 7" :key="d" :value="d">周{{ '一二三四五六日'[d-1] }}</option>
            </select>
            <input type="number" v-model.number="form.schedule_rule.config.start.hour" min="0" max="23"> 时
            <label>结束于:</label>
            <select v-model.number="form.schedule_rule.config.end.day">
              <!-- FIX: Added :key="d" -->
              <option v-for="d in 7" :key="d" :value="d">周{{ '一二三四五六日'[d-1] }}</option>
            </select>
            <input type="number" v-model.number="form.schedule_rule.config.end.hour" min="0" max="23"> 时
          </div>
          <div v-if="form.schedule_rule.type === 'date_range'" class="config-box">
            <label>开始日期时间</label>
            <input type="datetime-local" v-model="form.schedule_rule.config.start">
            <label>结束日期时间</label>
            <input type="datetime-local" v-model="form.schedule_rule.config.end">
          </div>
        </fieldset>

        <!-- 追踪方式 -->
        <fieldset>
          <legend>3. 追踪方式 (如何算完成?)</legend>
          <select v-model="form.tracking_mode" required>
            <option value="boolean">布尔型 (完成/未完成)</option>
            <option value="counter">计数型</option>
            <option value="round_based_counter">轮次计数型 (处理“任务债务”)</option>
          </select>

          <div v-if="form.tracking_mode === 'counter'" class="config-box">
            <label>默认目标值</label>
            <input type="number" v-model.number="form.tracking_config.goal" min="1">
            <label>目标覆盖规则 (可选)</label>
            <div v-for="(override, index) in form.tracking_config.overrides" :key="index" class="sub-config">
              如果小号目标包含 <input type="text" v-model="override.if_goal_contains">, 则目标变为 <input type="number" v-model.number="override.new_goal">
              <button type="button" @click="removeOverride(index)">-</button>
            </div>
            <button type="button" @click="addOverride">+ 添加覆盖规则</button>
          </div>

          <div v-if="form.tracking_mode === 'round_based_counter'" class="config-box">
            <label>每轮目标次数</label>
            <input type="number" v-model.number="form.tracking_config.goal_per_round" min="1">
            <label>轮次刷新日 (可多选)</label>
            <div class="checkbox-group">
              <!-- FIX: Added :key="d" -->
              <label v-for="d in 7" :key="d"><input type="checkbox" :value="d" v-model="form.tracking_config.reset_days"> 周{{ '一二三四五六日'[d-1] }}</label>
            </div>
            <label>轮次刷新时间 (小时)</label>
            <input type="number" v-model.number="form.tracking_config.reset_hour" min="0" max="23">
          </div>
        </fieldset>

        <!-- 高级规则 -->
        <fieldset>
          <legend>4. 高级规则 (可选)</legend>
          <div class="form-group">
            <label>激活条件: 仅当小号目标包含此关键词时出现</label>
            <input type="text" v-model="form.activation_condition.contains" placeholder="如：碎片">
          </div>
          <div class="form-group">
            <label>消耗资源: 关联一个资源池的名称</label>
            <input type="text" v-model="form.consumes_resource" placeholder="如：漂流次数">
          </div>
        </fieldset>

        <div class="form-actions">
          <button type="submit" class="btn-primary">添加任务</button>
        </div>
        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      </form>
    </div>

    <!-- 任务列表 -->
    <div class="card">
        <h2>任务列表</h2>
        <!-- ... 列表展示部分可以简化或保持原样 ... -->
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import apiClient from '@/api/axios';

const errorMessage = ref('');

const getInitialForm = () => ({
  name: '',
  category: '',
  schedule_rule: { type: 'daily', config: { reset_hour: 4 } },
  tracking_mode: 'boolean',
  tracking_config: { goal: 1, overrides: [] },
  activation_condition: { contains: '' },
  consumes_resource: ''
});

const form = ref(getInitialForm());

// 监听类型变化，重置配置对象以避免数据污染
watch(() => form.value.schedule_rule.type, (newType) => {
  if (newType === 'daily') form.value.schedule_rule.config = { reset_hour: 4 };
  if (newType === 'weekly') form.value.schedule_rule.config = { start: { day: 2, hour: 4 }, end: { day: 1, hour: 4 } };
  if (newType === 'date_range') form.value.schedule_rule.config = { start: '', end: '' };
});

watch(() => form.value.tracking_mode, (newMode) => {
    if (newMode === 'boolean') form.value.tracking_config = {};
    if (newMode === 'counter') form.value.tracking_config = { goal: 1, overrides: [] };
    if (newMode === 'round_based_counter') form.value.tracking_config = { goal_per_round: 5, reset_days: [], reset_hour: 4 };
});

const addOverride = () => {
  form.value.tracking_config.overrides.push({ if_goal_contains: '', new_goal: 1 });
};
const removeOverride = (index) => {
  form.value.tracking_config.overrides.splice(index, 1);
};

const addTask = async () => {
  errorMessage.value = '';
  try {
    // 准备要发送的 payload，将对象转换为 JSON 字符串
    const payload = {
      ...form.value,
      schedule_rule: JSON.stringify(form.value.schedule_rule),
      tracking_config: JSON.stringify(form.value.tracking_config),
      // 只有当用户填写了内容时，才发送这两个可选字段
      activation_condition: form.value.activation_condition.contains ? JSON.stringify({type: 'goal_dependency', ...form.value.activation_condition}) : null,
      consumes_resource: form.value.consumes_resource || null,
    };

    await apiClient.post('/tasks', payload);
    alert('任务添加成功!');
    form.value = getInitialForm(); // 重置表单
    // fetchTasks(); // 如果有列表，重新获取
  } catch (error) {
    errorMessage.value = error.response?.data?.error || '添加失败，请检查输入。';
  }
};
</script>

<style scoped>
fieldset { border: 1px solid #ddd; padding: 1.5rem; margin-bottom: 1.5rem; border-radius: 8px; }
legend { font-weight: bold; color: #2c3e50; padding: 0 0.5rem; }
.form-group { margin-bottom: 1rem; }
.config-box { background-color: #f8f9fa; border: 1px solid #e9ecef; padding: 1rem; margin-top: 1rem; border-radius: 4px; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }
.sub-config { display: flex; gap: 0.5rem; align-items: center; width: 100%; }
.checkbox-group { display: flex; gap: 1rem; }
input[type="text"], input[type="number"], select, input[type="datetime-local"] { padding: 0.5rem; border-radius: 4px; border: 1px solid #ccc; }
.form-actions { margin-top: 1.5rem; }
.error-message { color: #e74c3c; margin-top: 1rem; }
</style>
