import { createApp } from "vue";
import Antd from "ant-design-vue";
import * as Icons from "@ant-design/icons-vue";
import router from "./router";
import pinia from "./stores";
import "./assets/styles/default.scss";
import "ant-design-vue/dist/reset.css";
import App from "./App.vue";
import { installXGXToWindow, FastX } from "./FastX";
import printConsoleLogo from "./utils/consoleLogo";

printConsoleLogo();
installXGXToWindow();
const app = createApp(App);
FastX.registerCesiumXVueComponents(app);

Object.entries(Icons).forEach(([key, component]) => {
  app.component(key, component);
});

app.use(pinia);
app.use(router);
app.use(Antd);

app.mount("#app");
