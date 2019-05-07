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

import {findCurrentFiberUsingSlowPath, isFiberMounted} from './ReactFiberTreeReflection';
import {
  batchedUpdates,
  scheduleWork,
  flushPassiveEffects
} from './ReactFiberScheduler';
import {Sync} from './ReactFiberExpirationTime';
import {
  REACT_FORWARD_REF_TYPE,
  REACT_MEMO_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_PROVIDER_TYPE,
} from 'shared/ReactSymbols';
import {DidCapture} from 'shared/ReactSideEffectTags';
import {
  HostComponent,
  ClassComponent,
} from 'shared/ReactWorkTags';

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
        case REACT_CONTEXT_TYPE:
        case REACT_PROVIDER_TYPE:
          if (a._context !== undefined && b._context !== undefined) {
            return areCompatibleTypesForHotReload(a._context, b._context);
          }
          return (
            a.__debugIdentity !== undefined &&
            a.__debugIdentity === b.__debugIdentity
          );
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

// TODO: unify in one API?
export function scheduleUpdateForHotReload(root, updatedIdentities, invalidatedIdentities, lastFailedBoundaries) {
  flushPassiveEffects();
  let affectedFibers = [];
  let failedBoundaries = [];
  batchedUpdates(() => {
    recursivelyScheduleUpdates(
      root.current,
      new Set(updatedIdentities),
      new Set(invalidatedIdentities),
      new Set(lastFailedBoundaries),
      failedBoundaries,
      affectedFibers
    );
  });
  
  // Find failed boundaries.
  let wip = root.current.alternate;
  let fx = wip.firstEffect;
  while (fx !== null) {
    if ((fx.effectTag & DidCapture) === DidCapture && fx.tag === ClassComponent) {
      failedBoundaries.push(fx);
    }
    fx = fx.nextEffect;
  }

  let hostNodes = [];
  affectedFibers.forEach(f => {
    if (!isFiberMounted(f)) {
      return;
    }
    const hostFibers = findAllCurrentHostFibers(f);
    hostFibers.forEach(hf => hostNodes.push(hf.stateNode));
  })
  return {
    hostNodes,
    failedBoundaries
  };
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

function recursivelyScheduleUpdates(
  fiber,
  updatedIdentities,
  invalidatedIdentities,
  lastFailedBoundaries,
  failedBoundaries,
  affectedFibers
  ) {
  if (fiber.type !== null) {
    // Remount last failed boundaries.
    if (lastFailedBoundaries.has(fiber) || (fiber.alternate !== null && lastFailedBoundaries.has(fiber.alternate))) {
      fiber.elementType = 'DELETED';
      if (fiber.alternate) {
        fiber.alternate.elementType = 'DELETED';
      }
      // Force parent to re-render
      // TODO: this doesn't work for roots and probably other things
      fiber.return.memoizedProps = {
        ...fiber.return.memoizedProps,
        // TODO: this is not good
        __hotReloadAttempt: memoBuster++
      };
      scheduleWork(fiber.return, Sync);
      affectedFibers.push(fiber.return);
    }

    const unwrappedType = unwrapHotReloadableType(fiber.type);
    if (unwrappedType !== null && unwrappedType.__debugIdentity !== undefined) {
      // This Fiber was hot updated.
      if (updatedIdentities.has(unwrappedType.__debugIdentity)) {
        // Prevent bailout
        fiber.memoizedProps = {
          ...fiber.memoizedProps,
          // TODO: this is not good
          __hotReloadAttempt: memoBuster++
        };
        scheduleWork(fiber, Sync);
        affectedFibers.push(fiber);
        invalidateHooks(fiber);
        if (fiber.alternate !== null) {
          invalidateHooks(fiber.alternate);
        }
      }
      // This Fiber was invalidated and needs to remount.
      if (invalidatedIdentities.has(unwrappedType.__debugIdentity)) {
        fiber.elementType = 'DELETED';
        if (fiber.alternate) {
          fiber.alternate.elementType = 'DELETED';
        }
        // Force parent to re-render
        // TODO: this doesn't work for roots and probably other things
        fiber.return.memoizedProps = {
          ...fiber.return.memoizedProps,
          // TODO: this is not good
          __hotReloadAttempt: memoBuster++
        };
        scheduleWork(fiber.return, Sync);
        affectedFibers.push(fiber.return);
      }
    }
  };
  if (fiber.child !== null) {
    recursivelyScheduleUpdates(
      fiber.child,
      updatedIdentities,
      invalidatedIdentities,
      lastFailedBoundaries,
      failedBoundaries,
      affectedFibers
    );
  }
  if (fiber.sibling !== null) {
    recursivelyScheduleUpdates(
      fiber.sibling,
      updatedIdentities,
      invalidatedIdentities,
      lastFailedBoundaries,
      failedBoundaries,
      affectedFibers
    );
  }
}

function invalidateHooks(fiber: Fiber): void {
  const state = fiber.memoizedState;
  if (state === null) {
    return;
  }
  // TODO: proper check for tags.
  if (state.next === undefined) {
    return;
  }

  let hook = state;
  let anObjectHasNoName = {};
  while (hook !== null) {
    let deps = null;
    // TODO: proper check for hook type.
    // Currently it incorrectly can flag useReducer/useState.
    if (hook.memoizedState !== null && hook.memoizedState !== undefined) {
      if (Array.isArray(hook.memoizedState) && Array.isArray(hook.memoizedState[1])) {
        deps = hook.memoizedState[1];
      } else if (hook.memoizedState.deps) {
        deps = hook.memoizedState.deps;
      }
      if (deps !== null) {
        deps.invalidated = true; // TODO: less gross
      }
    }
    hook = hook.next;
  }
}

function findAllCurrentHostFibers(parent: Fiber): Array<Fiber> {
  const fibers = [];
  const currentParent = findCurrentFiberUsingSlowPath(parent);
  if (!currentParent) {
    return fibers;
  }

  let node: Fiber = currentParent;
  while (true) {
    if (node.tag === HostComponent) {
      fibers.push(node);
    } else if (node.child) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === currentParent) {
      return fibers;
    }
    while (!node.sibling) {
      if (!node.return || node.return === currentParent) {
        return fibers;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
  return fibers;
}
