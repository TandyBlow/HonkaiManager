// frontend/.eslintrc.js

module.exports = {
  root: true,
  env: {
    node: true,
    // 关键！定义 Vue 3 <script setup> 的编译宏环境
    'vue/setup-compiler-macros': true
  },
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended'
  ],
  parserOptions: {
    // 使用 @babel/eslint-parser 来解析代码
    parser: '@babel/eslint-parser',
    requireConfigFile: false // 如果你没有 babel.config.js 文件，这一行很重要
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    
    // 关闭组件名必须由多个单词组成的规则，方便开发
    'vue/multi-word-component-names': 'off'
  }
};
