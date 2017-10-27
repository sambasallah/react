/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

module.exports = function autoImporter(babel) {
  const t = babel.types;

  function shouldUseESModules(file) {
    const body = file.file.ast.program.body;
    return body.some(
      node =>
        node.type === 'ImportDeclaration' &&
        (!node.importKind || node.importKind === 'value')
    );
  }

  function getAssignIdent(path, file, state) {
    if (state.id) {
      return state.id;
    }
    if (shouldUseESModules(file)) {
      state.id = file.addImport('object-assign', 'default', 'assign');
    } else {
      // TODO: Remove this branch when CommonJS is gone
      state.id = path.scope.generateUidIdentifier('assign');
      path.scope.getProgramParent().push({
        id: state.id,
        init: t.callExpression(t.identifier('require'), [
          t.stringLiteral('object-assign'),
        ]),
      });
    }
    return state.id;
  }

  return {
    pre: function() {
      // map from module to generated identifier
      this.id = null;
    },

    visitor: {
      CallExpression: function(path, file) {
        if (path.get('callee').matchesPattern('Object.assign')) {
          // generate identifier and require if it hasn't been already
          var id = getAssignIdent(path, file, this);
          path.node.callee = id;
        }
      },

      MemberExpression: function(path, file) {
        if (path.matchesPattern('Object.assign')) {
          var id = getAssignIdent(path, file, this);
          path.replaceWith(id);
        }
      },
    },
  };
};
