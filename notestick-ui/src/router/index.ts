import { createRouter, createWebHashHistory, Router } from "vue-router";
import nprogress from "nprogress";
import "nprogress/nprogress.css";
import Home from "@/components/home/index.vue";
import CoOpGame from "@/components/co-op/index.vue";

nprogress.configure({});

const router: Router = createRouter({
  history: createWebHashHistory(),
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
      path: "/co-op",
      component: CoOpGame,
    },
  ],
});

router.beforeEach((to, from) => {
  nprogress.start();
});

router.afterEach(() => {
  nprogress.done();
});

export default router;
