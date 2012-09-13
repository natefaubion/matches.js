matches.js
==========

Matches.js brings the power and expressiveness of pattern matching to 
Javascript.

Install
-------

`npm install matches`

```js
var pattern = require("matches").pattern;
var mymap = pattern({
  '_, []' : function () { 
    return [];
  },
  'f, [x, xs...]' : function (f, x, xs) {
    return [f(x)].concat(mymap(f, xs));
  }
});

// [2, 4, 6, 8]
mymap(function (x) { return x * 2; }, [1, 2, 3, 4]);
```

Patterns
--------

### Literals

Check for specific values using number or string literals, `null`, or 
`undefined`.

```js
var myfn = pattern({
  // Null
  'null' : function () {...},

  // Undefined
  'undefined' : function () {...},

  // Numbers
  '42'    : function () { ... },
  '12.6'  : function () { ... },
  '1e+42' : function () { ... },

  // Strings
  '"foo"' : function () { ... },

  // Escape sequences must be double escaped.
  '"This string \\n matches \\n newlines."' : function () { ... }
});
```

### Wildcards

Underscores will match successfully on any value but ignore it. A single
underscore works well as a catch all pattern.

```js
var myfn = pattern({
  // Match if second argument is 12, ignoring the first
  '_, 12' : function () { ... },

  // Match on anything
  '_' : function () { ... }
});
```

### Identifiers

Patterns that start with lowercase letters will pass the value to the function.
Values are passed to the function in the same right to left order they are
declared in the pattern.

```js
var myfn = pattern({
  // Pass on the second argument if the first is 12
  '12, x': function (x) { ... },

  // Pass on the first and third argument, ignoring the second
  'x, _, y': function (x, y) { ... }
});
```

### Arrays

Match on the entire array, or only a few values.

```js
var myfn = pattern({
  // Empty array
  '[]' : function () { ... },

  // Strict comparison on contents
  '[1, 2, 3]': function () { ... },

  // Grab the first value, ignoring the rest
  '[x, ...]': function (x) { ... },

  // Split it into a head and tail
  '[head, tail...]': function (head, tail) { ... },

  // Grab the first and last items, ignoring the middle
  '[x, ..., y]': function (x, y) { ... },

  // Grab the last item
  '[..., last]': function (last) { ... },

  // Make a shallow clone
  '[clone...]': function (clone) { ... },

  // Grab the first item, but also pass on the whole array
  'arr@[first, ...]': function (arr, first) { ... }
});
```

### Objects

Like with an array, you can match on an entire object, or just a few keys.

```js
var myfn = pattern({
  // Empty object
  '{}': function () { ... },

  // Check that an object has only two keys 'x' and 'y', and pass to the function
  '{x, y}': function (x, y) { ... },

  // Check that an object has a key 'children' that contains an array
  '{children: [a, b], ...}': function (a, b) { ... },

  // Match on two keys, 'x' and 'y' and copy the rest to another object
  '{x: a@Number, y: b@Number, c...}': function (a, b, c) { ... },

  // Make a shallow clone of an object
  '{clone...}': function (clone) { ... }
})
```

### Core Javascript Types

Typecheck arguments using `Number`, `String`, `Date`, `RegExp`, `Function`,
`Array`, or `Object`.

```js
var myfn = pattern({
  // Takes a function and an array
  'fn@Function, arr@Array': function (fn, arr) { ... },

  // Takes a function and an object
  'fn@Function, obj@Object': function (fn, obj) { ... }
});
```

### Adt.js Types

Matches.js has builtin support for adt.js types. Adt.js is a library for
building algebraic data types in Javascript.

```js
// Create a new adt.js type
var Tree = adt.data({
  Empty : adt.single(),
  Node  : adt.record("val", "left", "right")
});

var mytree = Tree.Node(12, Tree.Empty(), Tree.Node(42, Tree.Empty(), Tree.Empty()));

var myfn = pattern({
  // Match on an Empty tree node
  'Empty': function () { ... },

  // Match on a Node with a value of 12
  'Node(12, _, _)': function () { ... },

  // Match on a Node that has non-Empty children
  'Node(_, Node, Node)': function () { ... }

  // Match on a Node that has a left child Node of 42 and an Empty right node
  'Node(val, Node(42, _, _), Empty)': function (val) { ... }
});
```

Find out more about adt.js: https://github.com/natefaubion/adt.js

Usage
-----

Matches.js exports one function, `pattern`.

```js
var pattern = require("matches").pattern;
```

### pattern(patternObj)

The simplest way is to give it an object with the keys being patterns, and the
values being functions. Each pattern will be tried in order until a match is
found.

```js
var arrayElems = pattern({
  '[]': function () { 
    return "This array is empty."; 
  },
  '[x]': function (x) { 
    return "This array has one element: " + x; 
  },
  '[x, y]': function (x, y) { 
    return "This array has two elements: " + x + " and " + y;
  },
  '[x, y, ...]': function (x, y) {
    return "This array is long. The first two elements are: " + x + " and " + y;
  }
});

arrayElems([1, 2, 3]);
```

### pattern(patternStr, successFn)

You can create individual pattern and function pairs.

```js
var emptyArray = pattern('[]', function () { return "Empty array" });

// "Empty array"
emptyArray([]);

// TypeError: "All patterns exhausted"
emptyArray(12);
```

### pattern(patternFn, successFn)

You can also create your own custom pattern functions. The `patternFn` takes
an array of arguments, and should return `false` for no match, or a new array
of arguments to forward on to the `successFn`.

```js
var greater42 = function (args) {
  if (args[0] >= 42) return [args[0]];
  return false;
};

var customPattern = pattern(greater42, function (x) {
  console.log(x);
});

// Logs 54
customPattern(54);

// TypeError: "All patterns exhausted"
customPattern(12);
```

### Combinators

You can combine any of these methods to create unique match chains using the
`alt` combinator.

```js

var wildcard = pattern('_', function () { return "No matches."; });
var mychain = pattern('1', function () { return "One"; })
  .alt({
    '2': function () { return "Two"; },
    '3': function () { return "Three"; }
  })
  .alt(wildcard);

// 'One'
mychain(1);

// 'Two'
mychain(2);

// 'No matches.'
mychain(5);
```

### Multiple Arguments

Separate matches for multiple arguments with a comma. Since you can pass any
number of arguments to functions in Javascript, Matches.js is not strict and
will happily combine patterns for varying numbers of arguments.

```js
var myfn = pattern({
  // Matches on the first three arguments. If more are passed, they are ignored.
  '1, "foo", [a, ...]': function (a) { return a; },

  // Matches on the first two arguments, ignoring the rest
  'a, fn@Function': function (a, fn) { return fn(a); },

  // Matches anything
  '_': function () { return null; }
});

// 12
myfn(6, function (x) { return x * 2; }, "foo", "bar");

// null
myfn(1, 2, 3, 4);
```

### Performance

Pattern strings are compiled to pure Javascript functions and then cached, so
in general, they are quite fast.

On a 2GHz core, average compilation time is around .12ms for a pattern
comprised of 5-6 sub-patterns. Pattern matched functions are around 3-4x slower
to dispatch than an equivalent hand-optimized function that does similar
type-checking. Keep in mind, that time is measured in the single microseconds 
(1µs vs 3µs) to dispatch 5 calls to the same function.
