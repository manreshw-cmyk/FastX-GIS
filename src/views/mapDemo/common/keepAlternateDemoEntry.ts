/** 保留注释切换用的单类 add / 拾取入口，避免 `noUnusedLocals` 报错 */
export function keepAlternateDemoEntry(...entries: readonly unknown[]): void {
  void entries
}
