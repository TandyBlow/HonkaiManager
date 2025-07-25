// frontend/src/plugins/qui.js
import Qui from '@qvant/qui-max';
import '@qvant/qui-max/styles'; // 引入样式

export default {
  install: (app) => {
    app.use(Qui, {
      // 你可以在这里进行全局配置，例如国际化
      // locales: { ... }
    });
  }
};
