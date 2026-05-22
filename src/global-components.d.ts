export {}

declare module 'vue' {
  interface GlobalComponents {
    XMap: (typeof import('./FastX/components/x-map.vue'))['default']
  }
}
