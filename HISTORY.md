## 0.4.0

* Added rest arguments. Argument length matching is now strict.
* Rest arguments have the identifier after the ellipsis ala ES6.
* Added custom extractors

## 0.3.1

* Added support for string keys in objects
* Fixed a bug in the compiled functions for objects matching on Object
prototype keys.
* Updated adt.js version number

## 0.3.0

* Removed specific adt.js support in favor of general custom type support.
* Removed hyper-specific tokens from the grammar like `emptyArray`, `emptyObject`,
`arrayRest`, and `objectRest` in favor of compile time checking.

## 0.2.1

Removed stray debug statement.

## 0.2.0

Refactored grammar/parser and compiler. Objects now support the same rest
syntax as arrays. The key-only or key-value syntax for objects can be mixed
and matched in the same pattern.

## 0.1.0

Initial release
