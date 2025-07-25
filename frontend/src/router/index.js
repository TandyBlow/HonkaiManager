// frontend/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import TasksView from '../views/TasksView.vue';
const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: '任务看板' } // 页面标题
  },
  {
    path: '/accounts',
    name: 'accounts',
    // 路由懒加载，访问该页面时才会加载对应组件
    component: () => import('../views/AccountsView.vue'),
    meta: { title: '小号管理' }
  },
  
  {
    path: '/tasks',
    name: 'tasks',
    //component: () => import('../views/TasksView.vue'),
    component: TasksView,
    meta: { title: '任务模板管理' }
  }
];
const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});
// 全局路由守卫，用于更新页面标题
router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title} - 崩坏3小号管理器` || '崩坏3小号管理器';
  next();
});
export default router;