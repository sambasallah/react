/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

jest.mock('../events/isEventSupported');

describe('EventPluginHub', () => {
  let React;
  let ReactDOM;
  let container;

  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactDOM = require('react-dom');

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
  });

  it('should prevent non-function listeners, at dispatch', () => {
    let node;
    expect(() => {
      node = ReactDOM.render(<div onClick="not a function" />, container);
    }).toWarnDev(
      'Expected `onClick` listener to be a function, instead got a value of `string` type.',
    );

    let uncaughtErrors = [];
    function handleWindowError(e) {
      uncaughtErrors.push(e.error);
    }
    window.addEventListener('error', handleWindowError);
    try {
      node.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
        }),
      );
    } finally {
      window.removeEventListener('error', handleWindowError);
    }
    expect(uncaughtErrors.length).toBe(1);
    expect(uncaughtErrors[0]).toEqual(
      expect.objectContaining({
        message:
          'Expected `onClick` listener to be a function, ' +
          'instead got a value of `string` type.',
      }),
    );
  });

  it('should not prevent null listeners, at dispatch', () => {
    const node = ReactDOM.render(<div onClick={null} />, container);
    node.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
      }),
    );
  });
});
