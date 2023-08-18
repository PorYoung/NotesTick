import Vue from "vue";
import VueRouter from "vue-router";
import Home from "@/components/home";
import Battle from "@/components/battle";
import Solo from "@/components/solo";
import SoloNoPad from "@/components/solo-nopad";
import FullScreen from "@/components/fullScreen";

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
			path: "/solo-nopad",
			component: SoloNoPad,
		},
		{
			path: "/battle",
			component: Battle,
		},
		{
			path: "/fullScreen",
			component: FullScreen,
		},
	],
});

export default router;
