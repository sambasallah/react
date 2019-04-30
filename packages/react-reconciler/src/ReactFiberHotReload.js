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

