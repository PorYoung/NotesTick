import { createApp } from "vue";
import router from "./router";
import App from "./App.vue";

/* Element UI */
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";

const app = createApp(App);
app.use(router).use(ElementPlus).mount("#app");
