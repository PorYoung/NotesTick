import { createRouter, createWebHashHistory, Router } from "vue-router";
import nprogress from "nprogress";
import "nprogress/nprogress.css";
import Home from "@/components/home/index.vue";
import CoOpGame from "@/components/co-op/index.vue";
import CoOpGameFull from "@/components/co-op/full.vue";

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
    {
      path: "/co-op-full",
      component: CoOpGameFull,
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
