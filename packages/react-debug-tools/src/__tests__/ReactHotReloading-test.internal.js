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
  let scheduleUpdateForHotReload;
  let lastCommittedRoot;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    global.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      inject: injected => {
        scheduleUpdateForHotReload = injected.scheduleUpdateForHotReload;
      },
      supportsFiber: true,
      onCommitFiberRoot: (id, root) => {
        lastCommittedRoot = root;
      },
      onCommitFiberUnmount: () => {},
    };

    jest.resetModules();

    React = require('react');
    ReactDOM = require('react-dom');
    act = require('react-dom/test-utils').act;
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
    scheduleUpdateForHotReload = null;
    lastCommittedRoot = null;
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
    scheduleUpdateForHotReload(lastCommittedRoot, [AppIdentity]);

    // State and DOM should be preserved, but color should change.
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('1');
    expect(el.className).toBe('red');
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('2');
    expect(el.className).toBe('red');

    ReactDOM.render(<AppV2 />, container);
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

    scheduleUpdateForHotReload(lastCommittedRoot, [AppIdentity]);

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

  it('can force remount if requested', () => {
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

    // Render the new implementation, but invalidate app identity.
    scheduleUpdateForHotReload(lastCommittedRoot, [AppIdentity], [AppIdentity]);

    // Neither state nor DOM should be preserved. Color should change.
    expect(el).not.toBe(container.firstChild);
    const newEl = container.firstChild;
    expect(newEl.textContent).toBe('0');
    expect(newEl.className).toBe('red');
    newEl.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(newEl).toBe(container.firstChild);
    expect(newEl.textContent).toBe('1');
    expect(newEl.className).toBe('red');

    // First type should still act as latest version.
    // This is important to avoid "zombie" renders from old function instances.
    ReactDOM.render(<AppV1 />, container);
    expect(newEl).toBe(container.firstChild);
    expect(newEl.textContent).toBe('1');
    expect(newEl.className).toBe('red');
    newEl.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(newEl).toBe(container.firstChild);
    expect(newEl.textContent).toBe('2');
    expect(newEl.className).toBe('red');

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

    // This time, preserve the DOM but update the implementation.
    scheduleUpdateForHotReload(lastCommittedRoot, [AppIdentity]);
    expect(newEl).toBe(container.firstChild);
    expect(newEl.textContent).toBe('2');
    expect(newEl.className).toBe('green');
    newEl.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(newEl).toBe(container.firstChild);
    expect(newEl.textContent).toBe('3');
    expect(newEl.className).toBe('green');
  });

  it('updates from memo() to memo() with inner identity', () => {
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
    const MemoAppV1 = React.memo(AppV1);

    // First render
    ReactDOM.render(<MemoAppV1 />, container);
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
    const MemoAppV2 = React.memo(AppV2);

    // Render the new implementation.
    scheduleUpdateForHotReload(lastCommittedRoot, [AppIdentity]);

    // State and DOM should be preserved, but color should change.
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('1');
    expect(el.className).toBe('red');
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('2');
    expect(el.className).toBe('red');

    // Check old type doesn't blow it away.
    ReactDOM.render(<MemoAppV2 prop="b" />, container);
    ReactDOM.render(<MemoAppV1 prop="a" />, container);
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('2');
    expect(el.className).toBe('red');
  });

  it('updates from forwardRef() to forwardRef() with inner identity', () => {
   const AppIdentity = React.createRef();

    function AppV1(props, ref) {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      return <h1 className="blue" onClick={handleClick}>{counter}</h1>;
    }
    AppV1.__debugIdentity = AppIdentity;
    AppIdentity.current = AppV1;
    const FwdAppV1 = React.forwardRef(AppV1);

    // First render
    ReactDOM.render(<FwdAppV1 />, container);
    const el = container.firstChild;
    expect(el.textContent).toBe('0');
    expect(el.className).toBe('blue');
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el.textContent).toBe('1');
    expect(el.className).toBe('blue');

    function AppV2(props, ref) {
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
    const FwdAppV2 = React.forwardRef(AppV2);

    // Render the new implementation.
    scheduleUpdateForHotReload(lastCommittedRoot, [AppIdentity]);

    // State and DOM should be preserved, but color should change.
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('1');
    expect(el.className).toBe('red');
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('2');
    expect(el.className).toBe('red');

    // Check old type doesn't blow it away.
    ReactDOM.render(<FwdAppV2 prop="b" />, container);
    ReactDOM.render(<FwdAppV1 prop="a" />, container);
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('2');
    expect(el.className).toBe('red');
  });

  it('returns the DOM nodes for updated components', () => {
    const AppIdentity = React.createRef();
    const CounterIdentity = React.createRef();

    function AppV1() {
      return (
        <div>
          <CounterV1 />
          <h2>Hello</h2>
          <CounterV1 />
        </div>
      )
    }
    AppV1.__debugIdentity = AppIdentity;
    AppIdentity.current = AppV1;

    function CounterV1() {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      return (
        <h1 className="blue" onClick={handleClick}>
          <span>
            {counter}
          </span>
        </h1>
      );
    }
    CounterV1.__debugIdentity = CounterIdentity;
    CounterIdentity.current = CounterV1;

    // First render
    ReactDOM.render(<AppV1 />, container);

    function CounterV2() {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      return (
        <h1 className="blue" onClick={handleClick}>
          <span>
            {counter}
          </span>
        </h1>
      );
    }
    CounterV2.__debugIdentity = CounterIdentity;
    CounterIdentity.current = CounterV2;

    // Render the new implementation.
    const {hostNodes} = scheduleUpdateForHotReload(lastCommittedRoot, [CounterIdentity]);
    expect(hostNodes).toEqual([
      container.firstChild.firstChild,
      container.firstChild.firstChild.nextSibling.nextSibling,
    ]);
  });

  it('detects triggered error boundaries', () => {
    class Boundary extends React.Component {
      state = {error: null};
      componentDidCatch(error) {
        this.setState({error});
      }
      render() {
        if (this.state.error) {
          return <h1>Oops: {this.state.error.message}</h1>
        }
        return this.props.children;
      }
    }

    const AppIdentity = React.createRef();
    function AppV1() {
      return <h2>Hello</h2>;
    }
    AppV1.__debugIdentity = AppIdentity;
    AppIdentity.current = AppV1;

    // First render
    ReactDOM.render(<Boundary><AppV1 /></Boundary>, container);
    expect(container.textContent).toBe('Hello');

    function AppV2() {
      throw new Error('No.');
    }
    AppV2.__debugIdentity = AppIdentity;
    AppIdentity.current = AppV2;

    // Render the new implementation.
    let failedBoundaries = scheduleUpdateForHotReload(lastCommittedRoot, [AppIdentity]).failedBoundaries;
    expect(container.textContent).toBe('Oops: No.');
    expect(failedBoundaries.length).toBe(1);

    function AppV3() {
      throw new Error('No again.');
    }
    AppV3.__debugIdentity = AppIdentity;
    AppIdentity.current = AppV3;
    failedBoundaries = scheduleUpdateForHotReload(lastCommittedRoot, [AppIdentity], [], failedBoundaries).failedBoundaries;
    expect(container.textContent).toBe('Oops: No again.');
    expect(failedBoundaries.length).toBe(1);

    function AppV4() {
      return <h1>Hi again</h1>;
    }
    AppV4.__debugIdentity = AppIdentity;
    AppIdentity.current = AppV4;
    failedBoundaries = scheduleUpdateForHotReload(lastCommittedRoot, [AppIdentity], [], failedBoundaries).failedBoundaries;
    expect(container.textContent).toBe('Hi again');
    expect(failedBoundaries.length).toBe(0);
  });

  // TODO: this is dubious
  it('preserves context with shared identity', () => {
    const ParentIdentity = React.createRef();
    const ChildIdentity = React.createRef();
    const ContextIdentity = React.createRef();

    const ContextV1 = React.createContext('defaultValue');
    ContextV1.__debugIdentity = ContextIdentity;
    ContextIdentity.current = ContextV1;

    function ParentV1() {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      return (
        <ContextV1.Provider value={counter}>
          <div onClick={handleClick}>
            <ChildV1 />
          </div>
        </ContextV1.Provider>
      );
    }
    ParentV1.__debugIdentity = ParentIdentity;
    ParentIdentity.current = ParentV1;

    function ChildV1() {
      const counter = React.useContext(ContextV1);
      return <div className='blue'>{counter}</div>;
    }
    ChildV1.__debugIdentity = ChildIdentity;
    ChildIdentity.current = ChildV1;

    ReactDOM.render(<ParentV1 />, container);
    const el = container.firstChild;
    expect(el.textContent).toBe('0');
    expect(el.firstChild.className).toBe('blue');
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('1');
    expect(el.firstChild.className).toBe('blue');

    // The edit will change all of them.

    const ContextV2 = React.createContext('defaultValue');
    ContextV2.__debugIdentity = ContextIdentity;
    ContextIdentity.current = ContextV2;

    function ParentV2() {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      return (
        <ContextV2.Provider value={counter}>
          <div onClick={handleClick}>
            <ChildV1 />
          </div>
        </ContextV2.Provider>
      );
    }
    ParentV2.__debugIdentity = ParentIdentity;
    ParentIdentity.current = ParentV2;

    function ChildV2() {
      // Read with a stale reference
      const counter = React.useContext(ContextV1);
      return <div className='red'>{counter}</div>;
    }
    ChildV2.__debugIdentity = ChildIdentity;
    ChildIdentity.current = ChildV2;

    // Render the new implementation.
    scheduleUpdateForHotReload(lastCommittedRoot, [ParentIdentity, ChildIdentity, ContextIdentity]);

    // State and DOM should be preserved, but color should change.
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('1');
    expect(el.firstChild.className).toBe('red');
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('2');
    expect(el.firstChild.className).toBe('red');
  });

  it('invalidates useMemo results', () => {
    const AppIdentity = React.createRef();

    function AppV1() {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      const transformed = React.useMemo(() => counter * 2, [counter]);
      return <h1 className="blue" onClick={handleClick}>{transformed}</h1>;
    }
    AppV1.__debugIdentity = AppIdentity;
    AppIdentity.current = AppV1;

    ReactDOM.render(<AppV1 />, container);
    const el = container.firstChild;
    expect(el.textContent).toBe('0');
    expect(el.className).toBe('blue');
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el.textContent).toBe('2');
    expect(el.className).toBe('blue');

    function AppV2() {
      const [counter, setCounter] = React.useState(0);
      function handleClick() {
        setCounter(c => c + 1);
      }
      const transformed = React.useMemo(() => counter * 10, [counter]);
      return <h1 className="red" onClick={handleClick}>{transformed}</h1>;
    }
    AppV2.__debugIdentity = AppIdentity;
    AppIdentity.current = AppV2;

    scheduleUpdateForHotReload(lastCommittedRoot, [AppIdentity]);
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('10');
    expect(el.className).toBe('red');
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('20');
    expect(el.className).toBe('red');
  });

  it('invalidates useEffect', () => {
    const AppIdentity = React.createRef();

    function AppV1() {
      const [counter, setCounter] = React.useState(0);
      React.useEffect(() => {
        setCounter(c => c + 1);
      }, []);
      return <h1 className="blue">{counter}</h1>;
    }
    AppV1.__debugIdentity = AppIdentity;
    AppIdentity.current = AppV1;

    act(() => {
      ReactDOM.render(<AppV1 />, container);      
    });
    const el = container.firstChild;
    expect(el.textContent).toBe('1');
    expect(el.className).toBe('blue');

    function AppV2() {
      const [counter, setCounter] = React.useState(0);
      React.useEffect(() => {
        setCounter(c => c + 5);
      }, []);
      return <h1 className="red">{counter}</h1>;
    }
    AppV2.__debugIdentity = AppIdentity;
    AppIdentity.current = AppV2;

    act(() => {
      scheduleUpdateForHotReload(lastCommittedRoot, [AppIdentity]);
    });
    expect(el).toBe(container.firstChild);
    expect(el.textContent).toBe('6');
    expect(el.className).toBe('red');
  });
});

/*
 TODO:
  + what about zombie renders? when parent keeps stale reference.
    + fix memo/forwardRef combinations
      - non-simple memo
    - lazy?
      - also check what happens when we add/remove wrappers
      - what if both inner and outer have identities
  x API to patch specific components
    x top-level re-render won't work for concrete deep updates
      x we also don't know which type is actually latest
    - resolveType?
      - think through what should happen with classes
        - that may help decide which fields to mutate etc
    - need to traverse down Suspense primary trees too?
  - hooks
    - offer a way to reset those?
  - error handling
  - DEV gates
*/