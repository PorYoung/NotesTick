import Vue from "vue";
import VueRouter from "vue-router";
import Home from "@/components/home";
import Battle from "@/components/battle";
import Solo from "@/components/solo";

Vue.use(VueRouter);

const router = new VueRouter({
	routes: [
		{
			path: "/",
			redirect: "/home",
		},
		{
			path: "/home",
			component: Home,
		},
		{
			path: "/solo",
			component: Solo,
		},
		{
			path: "/battle",
			component: Battle,
		},
	],
});

export default router;
