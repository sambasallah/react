/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {ReactElement} from 'shared/ReactElementType';
import type {Fiber} from './ReactFiber';

import {
  batchedUpdates,
  scheduleWork,
  flushPassiveEffects
} from './ReactFiberScheduler';
import {Sync} from './ReactFiberExpirationTime';
import {
  REACT_FORWARD_REF_TYPE,
  REACT_MEMO_TYPE,
} from 'shared/ReactSymbols';

export function areCompatibleTypesForHotReload(a: any, b: any): boolean {
  if (typeof a !== typeof b) {
    return false;
  }
  switch (typeof a) {
    case 'string':
      return false;
    case 'function':
      if (
        a.prototype && a.prototype.isReactComponent ||
        b.prototype && b.prototype.isReactComponent
      ) {
        // TODO: what's the class behavior?
        return false;
      }
      return (
        a.__debugIdentity !== undefined &&
        a.__debugIdentity === b.__debugIdentity
      );
    case 'object':
      if (a.$$typeof !== b.$$typeof) {
        return false;
      }
      switch (a.$$typeof) {
        case REACT_MEMO_TYPE:
          return areCompatibleTypesForHotReload(a.type, b.type);
        case REACT_FORWARD_REF_TYPE:
          return areCompatibleTypesForHotReload(a.render, b.render);
        default:
          return false;
      }
    default:
      return false;
  }
}

export function resolveTypeWithHotReload(type: Function): Function {
  const debugIdentity = type.__debugIdentity;
  if (debugIdentity === undefined) {
    return type;
  }
  return debugIdentity.current;
}

export function scheduleUpdateForHotReload(root, identities) {
  flushPassiveEffects();
  batchedUpdates(() => {
    recursivelyScheduleUpdates(root.current, new Set(identities));
  });
}

function unwrapHotReloadableType(type: mixed) {
  switch (typeof type) {
    case 'string':
      return null;
    case 'function':
      if (type.prototype && type.prototype.isReactComponent) {
        return null;
      }
      return type;
    case 'object':
      switch (type.$$typeof) {
        case REACT_MEMO_TYPE:
          return unwrapHotReloadableType(type.type);
        case REACT_FORWARD_REF_TYPE:
          return type.render;
        default:
          return null;
      }
    default:
      return false;
  }
}

let memoBuster = 0;

function recursivelyScheduleUpdates(fiber, identitySet) {
  if (fiber.type !== null) {
    const unwrappedType = unwrapHotReloadableType(fiber.type);
    if (unwrappedType !== null && unwrappedType.__debugIdentity !== undefined) {
      if (identitySet.has(unwrappedType.__debugIdentity)) {
        // Prevent bailout
        fiber.memoizedProps = {
          ...fiber.memoizedProps,
          // TODO: this is not good
          __hotReloadAttempt: memoBuster++
        };
        scheduleWork(fiber, Sync);
      }
    }
  };
  if (fiber.child !== null) {
    recursivelyScheduleUpdates(fiber.child, identitySet);
  }
  if (fiber.sibling !== null) {
    recursivelyScheduleUpdates(fiber.sibling, identitySet);
  }
}

