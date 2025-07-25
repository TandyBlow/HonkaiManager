// frontend/src/api/axios.js

import axios from 'axios';

// 创建一个 Axios 实例
const apiClient = axios.create({
  // 你的后端服务地址和端口
  baseURL: 'http://localhost:4000/api', 
  headers: {
    'Content-Type': 'application/json',
  },
});

// 导出这个实例，以便在其他地方使用
export default apiClient;
