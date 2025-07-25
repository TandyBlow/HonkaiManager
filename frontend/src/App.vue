<!-- frontend/src/App.vue -->
<template>
  <div id="app-container">
    <nav class="navbar">
      <div class="navbar-brand">崩坏3小号管理器</div>
      
      <!-- 导航链接的容器 -->
      <div class="nav-links">
        <router-link to="/">任务看板</router-link>
        <router-link to="/accounts">小号管理</router-link>
        <router-link to="/tasks">任务模板</router-link>
      </div>

    </nav>
    <main class="main-content">
      <router-view/>
    </main>
  </div>
</template>

<style>
/* 添加一些全局样式 */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  margin: 0;
  background-color: #f4f7f9;
  color: #333;
}
#app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.navbar {
  background-color: #2c3e50;
  color: white;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.navbar-brand {
  font-size: 1.5rem;
  font-weight: bold;
}

/* --- 这是关键的修改区域 --- */

.nav-links {
  display: flex;   /* 步骤1: 必须将容器设置为 flex 布局 */
  gap: 2.5rem;     /* 步骤2: 使用 gap 属性来创建项目之间的间距 (你可以调整 2.5rem 这个值) */
}

.nav-links a {
  color: white;
  text-decoration: none;
  /* 步骤3: 确保这里没有 margin-left, 因为 gap 已经处理了间距 */
  font-size: 1rem;
  transition: color 0.3s;
}

/* --- 修改区域结束 --- */


.nav-links a:hover,
.nav-links a.router-link-exact-active {
  color: #42b983; /* Vue 的标志性绿色 */
}
.main-content {
  flex-grow: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
/* 通用卡片样式 */
.card {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.05);
    padding: 1.5rem;
    margin-bottom: 1.5rem;
}
/* 通用按钮样式 */
button {
    cursor: pointer;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 5px;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background-color 0.3s, transform 0.1s;
}
button:active {
    transform: scale(0.98);
}
.btn-primary {
    background-color: #42b983;
    color: white;
}
.btn-primary:hover {
    background-color: #36a476;
}
.btn-danger {
    background-color: #e74c3c;
    color: white;
}
.btn-danger:hover {
    background-color: #c0392b;
}
.btn-secondary {
    background-color: #3498db;
    color: white;
}
.btn-secondary:hover {
    background-color: #2980b9;
}
/* 表单样式 */
input[type="text"], input[type="password"] {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 0.5rem;
}
</style>
