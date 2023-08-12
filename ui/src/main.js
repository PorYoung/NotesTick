import Vue from "vue";
import App from "./App.vue";
// import VueSocketIO from "vue-socket.io";

Vue.config.productionTip = false;

new Vue({
	render: (h) => h(App),
}).$mount("#app");
