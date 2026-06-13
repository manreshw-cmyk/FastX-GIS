import timelineClock from './timelineClock'
import * as geoDraw from './geoDraw'
import EntityFocusEffect from './entityFocusEffect'

const entityFocusEffect = new EntityFocusEffect()

export default {
  timelineClock,
  geoDraw,
  entityFocusEffect,
  EntityFocusEffect,
}

export * from './geoDraw'
export { EntityFocusEffect, entityFocusEffect }
export type {
  EntityFocusEffectOptions,
  EntityFocusEffectUpdateOptions,
  EntityFocusPosition,
  EntityFocusPositionInput,
  EntityFocusPositionTuple,
} from './entityFocusEffect'
