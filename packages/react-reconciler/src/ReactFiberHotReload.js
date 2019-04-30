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

export function acceptsTypeWithHotReload(fiber: Fiber, element: ReactElement): boolean {
  const fiberElementType = fiber.elementType;
  const elementType = element.type;
  if (
    fiberElementType.__debugIdentity !== undefined &&
    fiberElementType.__debugIdentity === elementType.__debugIdentity
  ) {
    return true;
  }
  return false;
}

export function resolveTypeWithHotReload(type: Function): Function {
  const debugIdentity = type.__debugIdentity;
  if (debugIdentity === undefined) {
    return type;
  }
  return debugIdentity.current;
}

