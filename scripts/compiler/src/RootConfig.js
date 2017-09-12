"use strict";

const traverser = require("./traverser");
const t = require("babel-types");
const serializer = require("./serializer");

// this can be done better
function filterConstructorProperties(object, constructorProperties) {
  if (object !== null) {
    if (Array.isArray(object)) {
      object.forEach(child => {
        filterConstructorProperties(child, constructorProperties);
      });
      return;
    } else if (object.type === "ExpressionStatement") {
      const expression = object.expression;

      filterConstructorProperties(expression, constructorProperties);
      return;
    } else if (object.type === "ReturnStatement") {
      // remove return statements
      if (object.argument.type === "SequenceExpression") {
        filterConstructorProperties(
          object.argument.expressions,
          constructorProperties
        );
      } else {
        debugger;
      }
      return;
    } else if (
      // remove Super(...)
      object.type === "CallExpression" &&
      object.callee.type === "Super"
    ) {
      return;
    } else if (object.type === "AssignmentExpression") {
      // remove ... = Super(...)
      if (
        object.right.type === "CallExpression" &&
        object.right.callee.type === "Super"
      ) {
        return;
      }
      // remove this.state = ...
      if (
        object.left.type === "MemberExpression" &&
        object.left.object.type === "ThisExpression" &&
        object.left.property.type === "Identifier" &&
        object.left.property.name === "state"
      ) {
        return;
      }
    } else if (object.type === "Identifier") {
      // NO-OP
      return;
    }
    if (object.type.indexOf("Expression") !== -1) {
      constructorProperties.push(t.expressionStatement(object));
    } else {
      constructorProperties.push(object);
    }
  }
}

function mergeLifecycleMethod(
  name,
  lifecycleMethod,
  lifecycleMethods,
  prototypeProperties,
  entry
) {
  if (lifecycleMethods[name] === undefined) {
    lifecycleMethods[name] = t.classMethod(
      lifecycleMethod.kind,
      lifecycleMethod.key,
      lifecycleMethod.params,
      t.blockStatement([])
    );
    prototypeProperties.push(lifecycleMethods[name]);
  }
  lifecycleMethod.body.body.forEach(componentWillMountStatement => {
    lifecycleMethods[name].body.body.push(
      addPrefixesToAstNodes(componentWillMountStatement, entry)
    );
  });
}

function findFirstMemberNodeOfMemberExpression(node) {
  while (node.type !== "Identifier") {
    if (node.type === "MemberExpression") {
      if (node.object.type === "ThisExpression") {
        node.property.parentNode = node;
        node = node.property;
      } else {
        node.object.parentNode = node;
        node = node.object;
      }
    }
  }
  return node;
}

function getNextMemberNodeOfMemberExpression(rootNode, prevNode) {
  let parentNode = prevNode.parentNode;
  let property;
  if (parentNode.object === prevNode) {
    property = parentNode.property;
  } else if (parentNode.parentNode !== undefined) {
    property = parentNode.parentNode.property;
  } else {
    property = rootNode.property;
  }
  return property;
}

const blacklist = {
  state: true,
  props: true,
  context: true,
  refs: true,
  setState: true,
  forceUpdate: true,
  displayName: true,
  defaultProps: true,
};

function addPrefixesToAstNodes(entryNode, entry) {
  const thisAccessors = entry.thisClass.thisObject.accessors;
  const prefix = entry.key;
  const propsValue = entry.props;
  const scope = traverser.createModuleScope();
  scope.findAndReplace = {
    MemberExpression(node) {
      if (node.object.type === "ThisExpression") {
        // handle this.* instance properties/methods
        const firstNode = findFirstMemberNodeOfMemberExpression(node.property);

        const name = firstNode.name;
        if (thisAccessors.has(name) && blacklist[name] !== true) {
          firstNode.name = prefix + name;
        }
        return true;
      } else if (node.object.type === "MemberExpression") {
        // handle this.state and this.props
        const firstNode = findFirstMemberNodeOfMemberExpression(node.object);
        const name = firstNode.name;
        if (name === "state") {
          const property = getNextMemberNodeOfMemberExpression(node, firstNode);
          property.name = prefix + property.name;
          return true;
        } else if (name === "props") {
          // we need to replace with correct props
          const memberName = getNextMemberNodeOfMemberExpression(
            node,
            firstNode
          ).name;
          const propValue = propsValue.properties.get(memberName);
          if (propsValue !== undefined) {
            const value = propValue.descriptor.value;
            if (value.isIntrinsic()) {
              if (value.intrinsicName.indexOf("$F$") === 0) {
                return serializer.convertPrefixPlaceholderToExpression(
                  value.intrinsicName
                );
              }
            }
            return value.buildNode();
          }
        }
      }
    }
  };
  traverser.traverse(entryNode, traverser.Actions.FindAndReplace, scope);
  return entryNode;
}

class RootConfig {
  constructor() {
    this._entries = new Set();
    this._entriesCache = null;
    this.useClassComponent = false;
  }
  addEntry(props, theClass) {
    const key =
      Math.random().toString(36).replace(/[^a-z]+/g, "").substring(0, 3) + "_";
    const entry = {
      constructorProperties: null,
      key: key,
      props: props,
      prototypeProperties: null,
      state: null,
      thisClass: theClass
    };

    this._entries.add(entry);
    return {
      rootConfigEntry: entry,
      entryKey: key
    };
  }
  _getEntries() {
    if (this._entriesCache === null) {
      this._entriesCache = Array.from(this._entries.values());
    }
    return this._entriesCache;
  }
  getPrototypeProperties() {
    const entries = this._getEntries();
    const prototypeProperties = [];
    const lifecycleMethods = {};
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.prototypeProperties !== null) {
        entry.prototypeProperties.forEach(prototypeProperty => {
          // skip it if it starts with _render
          const name = prototypeProperty.key.name;
          if (name.indexOf("_render") === 0 || name.indexOf("render") === 0) {
            // NO OP
            console.log(
              `Did not include prototype method "${name}" as it looks like a render method on an inlined component.`
            );
          } else if (
            name === "componentWillMount" ||
            name === "componentDidMount" ||
            name === "componentWillUpdate" ||
            name === "componentDidUpdate" ||
            name === "componentWillUnmount" ||
            name === "shouldComponentUpdate" ||
            name === "componentWillReceiveProps" ||
            name === "componentDidCatch"
          ) {
            mergeLifecycleMethod(
              name,
              prototypeProperty,
              lifecycleMethods,
              prototypeProperties,
              entry
            );
          } else {
            prototypeProperties.push(
              t.classMethod(
                prototypeProperty.kind,
                t.identifier(entry.key + prototypeProperty.key.name),
                prototypeProperty.params,
                addPrefixesToAstNodes(prototypeProperty.body, entry)
              )
            );
          }
        });
      }
    }
    return prototypeProperties;
  }
  getConstructorProperties() {
    const entries = this._getEntries();
    let constructorProperties = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.constructorProperties !== null) {
        if (constructorProperties === null) {
          constructorProperties = [];
        }
        addPrefixesToAstNodes(
          t.blockStatement(entry.constructorProperties),
          entry
        );
        filterConstructorProperties(
          entry.constructorProperties,
          constructorProperties
        );
      }
    }
    return constructorProperties;
  }
  getMergedState() {
    const entries = this._getEntries();
    let mergedState = null;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.state !== null) {
        if (mergedState === null) {
          mergedState = t.objectExpression([]);
        }
        entry.state.properties.forEach(originalProperty => {
          mergedState.properties.push(
            t.objectProperty(
              t.identifier(entry.key + originalProperty.key.name),
              addPrefixesToAstNodes(originalProperty.value, entry)
            )
          );
        });
      }
    }
    return mergedState;
  }
}

module.exports = RootConfig;
