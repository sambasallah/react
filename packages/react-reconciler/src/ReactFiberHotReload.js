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

// TODO: this leaks
let latestTypeByKey = new Map();

export function acceptsTypeWithHotReload(fiber: Fiber, element: ReactElement): boolean {
  const fiberElementType = fiber.elementType;
  const elementType = element.type;
  if (
    fiberElementType.__key !== undefined &&
    fiberElementType.__key === elementType.__key
  ) {
    // TODO: we don't actually know which one is latest.
    latestTypeByKey.set(fiberElementType.__key, elementType);
    return true;
  }
  return false;
}

export function resolveTypeWithHotReload(type: Function): Function {
  const key = type.__key;
  if (key === undefined) {
    return type;
  }
  return latestTypeByKey.get(key) || type;
}

