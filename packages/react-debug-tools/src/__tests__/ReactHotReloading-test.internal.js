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

  it('preserves states rendering different types with shared identity', () => {
    const AppIdentity = React.createRef();

    function AppV1() {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      return <h1 className="blue" onClick={handleClick}>{counter}</h1>;
    }
    AppV1.__debugIdentity = AppIdentity;
    AppIdentity.current = AppV1;

    // First render
    ReactDOM.render(<AppV1 />, container);
    const el = container.firstChild;
    expect(el.textContent).toBe('0');
    expect(el.className).toBe('blue');
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el.textContent).toBe('1');
    expect(el.className).toBe('blue');

    function AppV2() {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      // Different color
      return <h1 className="red" onClick={handleClick}>{counter}</h1>;
    }
    AppV2.__debugIdentity = AppIdentity;
    // This is now the latest version.
    AppIdentity.current = AppV2;

    // Render the new implementation.
    // State and DOM should be preserved, but color should change.
    ReactDOM.render(<AppV2 />, container);
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('1');
    expect(el.className).toBe('red');
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('2');
    expect(el.className).toBe('red');

    // First type should still act as latest version.
    // This is important to avoid "zombie" renders from old function instances.
    ReactDOM.render(<AppV1 />, container);
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('2');
    expect(el.className).toBe('red');
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('3');
    expect(el.className).toBe('red');

    function AppV3() {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      // Different color
      return <h1 className="green" onClick={handleClick}>{counter}</h1>;
    }
    AppV3.__debugIdentity = AppIdentity;
    AppIdentity.current = AppV3;

    // Check they're all equivalent.
    ReactDOM.render(<AppV1 />, container);
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('3');
    expect(el.className).toBe('green');
    ReactDOM.render(<AppV3 />, container);
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('3');
    expect(el.className).toBe('green');
    ReactDOM.render(<AppV2 />, container);
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('3');
    expect(el.className).toBe('green');
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('4');
    expect(el.className).toBe('green');

    // Check we don't preserve state when switching identities.
    function SomethingElse() {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      return <h1 className="orange" onClick={handleClick}>{counter}</h1>;
    }
    SomethingElse.__debugIdentity = React.createRef();
    SomethingElse.__debugIdentity.current = SomethingElse;
    ReactDOM.render(<SomethingElse />, container);
    expect(el).not.toBe(container.firstChild);
    const newEl = container.firstChild;
    expect(newEl.textContent).toBe('0');
    expect(newEl.className).toBe('orange');
  });
});

/*
 TODO:
  + what about zombie renders? when parent keeps stale reference.
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