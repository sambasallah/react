/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const ReactDebugCurrentFrame = {};

if (__DEV__) {
  let implStack = [];

  var getCurrentStackImplementation = function() {
    return implStack[implStack.length - 1];
  };

  ReactDebugCurrentFrame.pushStackImplementation = function(
    getStack: () => string | null,
  ): void {
    console.log('push');
    // if (getCurrentStackImplementation() !== getStack) {
    implStack.push(getStack);
    // }
  };

  ReactDebugCurrentFrame.popStackImplementation = function(
    getStack: () => string | null,
  ): void {
    console.log('pop');
    // if (getCurrentStackImplementation() === getStack) {
    implStack.pop();
    // }
  };

  ReactDebugCurrentFrame.getStackAddendum = function(): string | null {
    console.log('get', implStack.length);
    if (implStack.length > 0) {
      const impl = getCurrentStackImplementation();
      return impl();
    }
    return null;
  };
}

export default ReactDebugCurrentFrame;
