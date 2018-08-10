/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import invariant from 'shared/invariant';
import invokeGuardedCallback from './invokeGuardedCallback';

const ReactErrorUtils = {
  // Used by Fiber to simulate a try-catch.
  _caughtError: (null: mixed),
  _hasCaughtError: (false: boolean),
  // $FlowFixMe WeakSet typing isn't correct in Flow
  _suppressedErrors: ((typeof WeakSet === 'function'
    ? new WeakSet()
    : null): any),

  // Used by event system to capture/rethrow the first error.
  _rethrowError: (null: mixed),
  _hasRethrowError: (false: boolean),

  /**
   * Call a function while guarding against errors that happens within it.
   * Returns an error if it throws, otherwise null.
   *
   * In production, this is implemented using a try-catch. The reason we don't
   * use a try-catch directly is so that we can swap out a different
   * implementation in DEV mode.
   *
   * @param {String} name of the guard to use for logging or debugging
   * @param {Function} func The function to invoke
   * @param {*} context The context to use when calling the function
   * @param {...*} args Arguments for function
   */
  invokeGuardedCallback<A, B, C, D, E, F, Context>(
    name: string | null,
    func: (a: A, b: B, c: C, d: D, e: E, f: F) => mixed,
    context: Context,
    a: A,
    b: B,
    c: C,
    d: D,
    e: E,
    f: F,
  ): boolean {
    return invokeGuardedCallback.apply(ReactErrorUtils, arguments);
  },

  /**
   * Same as invokeGuardedCallback, but instead of returning an error, it stores
   * it in a global so it can be rethrown by `rethrowCaughtError` later.
   * TODO: See if _caughtError and _rethrowError can be unified.
   *
   * @param {String} name of the guard to use for logging or debugging
   * @param {Function} func The function to invoke
   * @param {*} context The context to use when calling the function
   * @param {...*} args Arguments for function
   */
  invokeGuardedCallbackAndCatchFirstError<A, B, C, D, E, F, Context>(
    name: string | null,
    func: (a: A, b: B, c: C, d: D, e: E, f: F) => void,
    context: Context,
    a: A,
    b: B,
    c: C,
    d: D,
    e: E,
    f: F,
  ): boolean {
    const isSuppressed = ReactErrorUtils.invokeGuardedCallback.apply(
      this,
      arguments,
    );
    if (ReactErrorUtils.hasCaughtError()) {
      const error = ReactErrorUtils.clearCaughtError();
      if (!ReactErrorUtils._hasRethrowError) {
        ReactErrorUtils._hasRethrowError = true;
        ReactErrorUtils._rethrowError = error;
      }
    }
    return isSuppressed;
  },

  /**
   * During execution of guarded functions we will capture the first error which
   * we will rethrow to be handled by the top level error handler.
   */
  rethrowCaughtError() {
    return rethrowCaughtError.apply(ReactErrorUtils, arguments);
  },

  hasCaughtError() {
    return ReactErrorUtils._hasCaughtError;
  },

  clearCaughtError() {
    if (ReactErrorUtils._hasCaughtError) {
      const error = ReactErrorUtils._caughtError;
      ReactErrorUtils._caughtError = null;
      ReactErrorUtils._hasCaughtError = false;
      return error;
    } else {
      invariant(
        false,
        'clearCaughtError was called but no error was captured. This error ' +
          'is likely caused by a bug in React. Please file an issue.',
      );
    }
  },

  isErrorSuppressed(error: any): boolean {
    const suppressedErrors = ReactErrorUtils._suppressedErrors;
    if (suppressedErrors) {
      return suppressedErrors.has(error);
    }
    return false;
  },

  markErrorAsSuppressed(error: any) {
    const suppressedErrors = ReactErrorUtils._suppressedErrors;
    if (suppressedErrors) {
      return suppressedErrors.add(error);
    }
  },
};

let rethrowCaughtError = function() {
  if (ReactErrorUtils._hasRethrowError) {
    const error = ReactErrorUtils._rethrowError;
    ReactErrorUtils._rethrowError = null;
    ReactErrorUtils._hasRethrowError = false;
    throw error;
  }
};

export default ReactErrorUtils;
