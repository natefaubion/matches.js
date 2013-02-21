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
  'f, [x, ...xs]' : function (f, x, xs) {
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

Underscores will match successfully on any value but ignore it.

```js
var myfn = pattern({
  // Match if second argument is 12, ignoring the first
  '_, 12' : function () { ... }
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

### Rest Arguments

Use an ellipsis for rest arguments. A single ellipsis works as a catch all
pattern.

```js
var myfn = pattern({
  // Match if first argument is 12, get all the rest as an array
  '12, ...args': function (args) { ... },

  // Get the last argument
  '..., x': function (x) { ... },

  // Match on anything and any number of arguments
  '...': function () { ... }
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
  '[head, ...tail]': function (head, tail) { ... },

  // Grab the first and last items, ignoring the middle
  '[x, ..., y]': function (x, y) { ... },

  // Grab the last item
  '[..., last]': function (last) { ... },

  // Make a shallow clone
  '[...clone]': function (clone) { ... },

  // Grab the first item, but also pass on the whole array
  'arr@[first, ...]': function (arr, first) { ... }
});
```

### Rest Expressions

Rests (`...`) can do more than just split up an array. You can combine them
with arbitrary patterns to apply said pattern across every element in the array.

```js
var myfn = pattern({
  // Make sure every element is a string
  '[...String]': function () { ... },

  // Extract values from tuples
  '[...[x, y]]': function (xs, ys) { ... },

  // Extract values from objects
  '[...{name}]': function (names) { ... },

  // You can even nest rest expressions
  '[...[head, ...tail]]': function (heads, tails) { ... }
});
```

### Objects

Like with an array, you can match on an entire object, or just a few keys.
Unlike arrays, matching is only non-strict. It checks that the keys exist, but
other keys are allowed to exist in the object.

```js
var myfn = pattern({
  // Empty object
  '{}': function () { ... },

  // Check that an object has two keys 'x' and 'y', and pass to the function
  '{x, y}': function (x, y) { ... },

  // Check that an object has a key 'children' that contains an array
  '{children: [a, b]}': function (a, b) { ... },
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

### Custom Types

You can add pattern matching support for your own classes.

```js
// Create a new class
function MyClass () {
  this.val = 1;
}

// Matches.js will check for the non-standard attribute `name` on the constructor
// function. If you are in the browser and want wider support, or are using
// anonymous functions, make sure you tag your constructor with `className`.
MyClass.className = "MyClass";

// Add the static method `unapply` for array-like matching.
MyClass.unapply = function (obj) {
  return [obj.val];
};

// Add the static method `unapplyObj` for object-like matching.
MyClass.unapplyObj = function (obj) {
  return {
    'val': obj.val
  };
};

// Now you can match on your object.
var myfn = pattern({
  // Type-checking
  'MyClass': function () { ... },

  // Array-like matching
  'MyClass(a)': function (a) { ... },

  // Object-like matching
  'MyClass{val: a}': function (a) { ... }
});
```

### Adt.js Types

Adt.js ships with builtin support for matches.js. Adt.js is a library for
building algebraic data types or case classes in Javascript.

```js
// Create a new adt.js type
var Tree = adt.data({
  Empty : adt.single(),
  Node  : adt.record("val", "left", "right")
});

var mytree = Tree.Node(12, Tree.Empty, Tree.Node(42, Tree.Empty, Tree.Empty);

var myfn = pattern({
  // Match on an Empty tree node
  'Empty': function () { ... },

  // Match on a Node with a value of 12
  'Node(12, ...)': function () { ... },

  // Match using named keys
  'Node{val: 12}': function () { ... },

  // Match on a Node that has non-Empty children
  'Node(_, Node, Node)': function () { ... }

  // Match on a Node that has a left child Node of 42 and an Empty right node
  'Node(val, Node(42, _, _), Empty)': function (val) { ... }
});
```

Find out more about adt.js: https://github.com/natefaubion/adt.js

### Custom Extractors

Extend matches.js with custom extractors.

```js
// Naive email extractor.
// Extractors are passed the value, and a `pass` function. In order to count as
// a successful match, the extractor must return an instance of pass.
matches.extractors.email = function (val, pass) {
  if (typeof val === "string" && val.indexOf("@") > 0) {
    var parts = val.split("@");
    return pass({
      user: parts[0],
      domain: parts[1]
    });
  }
};

var myfn = pattern({
  // Extractors are called by prefixing the name with a $
  '$email(x)': function (x) { ... },

  // Match on the extracted value
  '$email(x@{domain: "foo.com"})': function (x) { ... }
});
```

Usage
-----

Matches.js exports four functions, `pattern`, `caseOf`, `extract`, and
`extractOne`.

```js
var matches = require("matches");
var pattern = matches.pattern;
var caseOf  = matches.caseOf;
var extract = matches.extract;
var extractOne = matches.extractOne;
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

### caseOf(...args, patternObj)

You can use `caseOf` to do ad-hoc pattern matching on objects. It's the same
as immediately invoking a `pattern` function, but lets you put the arguments
first.

```js
var result = caseOf(42, {
  'x@Number' : function (x) { return x * 2; },
  '_'        : function () { return null; }
});

// Is the same as...
var result = pattern({
  // ...
})(42);
```

### extract(patternStr, ...args)

Use extract to pull values out of other values. It works much like `match` on
strings. If there was a succesful match, it will return an array of extracted
values. If the match failed, it will return `null`.

```js
var res = extract('[...{name}]', objArray);
```

### extractOne(patternStr, ...args)

This is like `extract` but returns the first value instead of an array. This
works well for traversing a deep structure.

```js
var val = extractOne('{some: {nested: {structure: val}}}', obj);
```

*Note:* this will also return `undefined` on failure. So keep that in mind if 
`undefined` could be a valid value.

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
will happily combine patterns for varying numbers of arguments. However,
Matches.js is strict on the number of arguments within the pattern.

```js
var myfn = pattern({
  // Matches on exactly three arguments
  '1, "foo", [a, ...]': function (a) { return a; },

  // Matches on the first two arguments, ignoring the rest
  'a, fn@Function, ...': function (a, fn) { return fn(a); },

  // Matches anything
  '...': function () { return null; }
});
```

### Performance

Pattern strings are compiled to pure Javascript functions and then cached, so
in general, they are quite fast.

On a 2GHz core, average compilation time is around .12ms for a pattern
comprised of 5-6 sub-patterns. Pattern matched functions are around 3-4x slower
to dispatch than an equivalent hand-optimized function that does similar
type-checking. Keep in mind, that time is measured in the single microseconds 
(1µs vs 3µs) to dispatch 5 calls to the same function.
