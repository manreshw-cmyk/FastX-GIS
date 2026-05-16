export {}

declare module 'vue' {
  interface GlobalComponents {
    XMap: (typeof import('./CesiumX/components/x-map.vue'))['default']
  }
}
