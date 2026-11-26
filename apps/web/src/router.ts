import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      // Shareable room link, e.g. /room/K7QX2M
      path: '/room/:code',
      name: 'room',
      component: () => import('./views/RoomView.vue'),
      props: (route) => ({ code: String(route.params['code']).toUpperCase() }),
    },
    { path: '/profile', name: 'profile', component: () => import('./views/ProfileView.vue') },
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
