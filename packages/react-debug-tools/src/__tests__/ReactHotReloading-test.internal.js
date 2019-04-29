/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

describe('React hot reloading', () => {
  let React;
  let ReactDOM;
  let act;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    global.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      inject: injected => {
        // TODO
      },
      supportsFiber: true,
      onCommitFiberRoot: () => {},
      onCommitFiberUnmount: () => {},
    };

    jest.resetModules();

    React = require('react');
    ReactDOM = require('react-dom');
    act = ReactDOM.act;
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
  });

  fit('test', () => {
    function AppV1() {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      return <h1 className="blue" onClick={handleClick}>{counter}</h1>;
    }

    function AppV2() {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      // Different color
      return <h1 className="red" onClick={handleClick}>{counter}</h1>;
    }

    AppV1.__key = 'App'
    AppV2.__key = 'App'

    ReactDOM.render(<AppV1 />, container);
    const el = container.firstChild;
    expect(el.textContent).toBe('0');
    expect(el.className).toBe('blue');

    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el.textContent).toBe('1');
    expect(el.className).toBe('blue');

    // Hot reload
    // TODO: actual API
    ReactDOM.render(<AppV2 />, container);
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('1');
    expect(el.className).toBe('red');

  })
});

/*
 TODO:
  - what about zombie renders? when parent keeps stale reference.
    - maybe treat it as lazy and have a weakmap<type, type>.
    - fix memo/forwardRef combinations
        - simple memo is special
        - lazy?
  - API to patch specific components
    - top-level re-render won't work for concrete deep updates
      - we also don't know which type is actually latest
    - resolveType?
      - think through what should happen with classes
        - that may help decide which fields to mutate etc
    - need to traverse down Suspense primary trees too?
  - hooks
    - offer a way to reset those?
  - error handling
  - DEV gates
*/