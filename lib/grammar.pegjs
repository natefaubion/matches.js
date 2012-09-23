// Utility Functions
// -----------------

{
  // Merges a head token and tail tokens into a single list. The tail tokens
  // usually contain commas and whitespace, so the index is required to extract
  // the correct token from the tail.
  function headTailMerge (head, tail, index) {
    var result = [head];
    for (var i = 0; i < tail.length; i++) {
      result.push(tail[i][index])
    }
    return result;
  }

  // Checks for multiple rest tokens within a list of patterns.
  function hasMultiRest (patterns) {
    for (var i = 0, count = 0, pat; (pat = patterns[i]); i++) {
      if (pat.type === "rest" || pat.type === "restIdentifier") count += 1;
      if (count > 1) return true;
    }
    return false;
  }

  // Returns all pattern strings of a list of children
  function patternStrings (children) {
    return children.map(function (child) {
      return child.pattern;
    });
  }

  function throwMultRestError (patternStr) {
    throw new SyntaxError("Multiple rest paramaters are not allowed in sub-pattern " + patternStr);
  }
}

// Start
// -----

start
  = _ args:argumentList _ {
      return args;
    }

// Composite Tokens
// ----------------

argumentList
  = patterns:patterns {
      var patStrings = patternStrings(patterns);
      return {
        pattern: patStrings.join(","),
        type: "argumentList",
        value: patterns
      };
    }

array
  = "[" _ patterns:arrayRestPatterns? _ "]" {
      patterns || (patterns = []);
      var patStrings = patternStrings(patterns);
      var patternStr = "[" + patStrings.join(",") + "]";
      if (hasMultiRest(patterns)) throwMultRestError(patternStr);
      return {
        pattern: patternStr,
        type: "array",
        children: patterns
      };
    }

object
  = "{" _ patterns:objectRestPatterns? _ "}" {
      patterns || (patterns = []);
      var patStrings = patternStrings(patterns);
      var patternStr = "{" + patStrings.join(",") + "}";
      if (hasMultiRest(patterns)) throwMultRestError(patternStr);
      return {
        pattern: patternStr,
        type: "object",
        children: patterns
      };
    }

adtClass
  = name:classNameChars "(" _ patterns:patterns _ ")" {
      var patStrings = patternStrings(patterns);
      return {
        pattern: name + "(" + patStrings.join(",") + ")",
        type: "adtClass",
        value: name,
        children: patterns
      };
    }

capture
  = ident:identifierChars _ "@" _ pattern:capturePattern {
      return {
        pattern: ident + "@" + pattern.pattern,
        type: "capture",
        value: ident,
        children: [pattern]
      };
    }

keyValue
  = key:keyChars _ ":" _ pattern:pattern {
      return {
        pattern: key + ":" + pattern.pattern,
        type: "keyValue",
        value: key,
        children: [pattern]
      };
    }

// Composite Helpers
// -----------------

patterns
  = head:pattern tail:(_ "," _ pattern)* {
      return headTailMerge(head, tail, 3);
    }

pattern
  = wildcard
  / nullLiteral
  / undefinedLiteral
  / booleanLiteral
  / numberLiteral
  / stringLiteral
  / array
  / object
  / adtClass
  / className
  / capture
  / identifier

capturePattern
  = array
  / object
  / adtClass
  / className

arrayRestPatterns
  = head:(restPattern / pattern) tail:(_ "," _ (restPattern / pattern))* {
      return headTailMerge(head, tail, 3);
    }

objectRestPatterns
  = head:(restPattern / objectPattern) tail:(_ "," _ (restPattern / objectPattern))* {
      return headTailMerge(head, tail, 3);
    }

objectPattern
  = keyValue
  / key

restPattern
  = restIdentifier
  / rest

// Simple Tokens
// -------------

wildcard
  = "_" {
      return {
        pattern: "_",
        type: "wildcard"
      };
    }

identifier
  = ident:identifierChars {
      return {
        pattern: ident,
        type: "identifier",
        value: ident
      };
    }

jsIdentifier
  = ident:jsIdentifierChars {
      return {
        pattern: ident,
        type: "jsIdentifier",
        value: ident
      };
    }

restIdentifier
  = ident:identifierChars restChars {
      return {
        pattern: ident + "...",
        type: "restIdentifier",
        value: ident
      };
    }

rest
  = restChars {
      return {
        pattern: "...",
        type: "rest"
      };
    }

className
  = name:classNameChars {
      return {
        pattern: name,
        type: "className",
        value: name
      };
    }

key
  = key:keyChars {
      return {
        pattern: key,
        type: "key",
        value: key
      };
    }

// Literal Tokens
// --------------

nullLiteral
  = "null" {
      return {
        pattern: "null",
        type: "null"
      };
    }

undefinedLiteral
  = "undefined" {
      return {
        pattern: "undefined",
        type: "undefined"
      };
    }

booleanLiteral
  = bool:boolean {
      return {
        pattern: bool,
        type: "boolean",
        value: bool === "true"
      }
    }

numberLiteral
  = num:number {
      return {
        pattern: num,
        type: "number",
        value: parseFloat(num)
      };
    }

stringLiteral
  = str:string {
      return {
        pattern: quote(str),
        type: "string",
        value: str
      }
    }

// Special Character Sequences
// ---------------------------

boolean
  = "true"
  / "false"

keyChars
  = jsIdentifierChars

restChars
  = "..."

identifierChars "identifier"
  = head:[a-z] tail:[_$a-zA-Z0-9]* {
      return head + tail.join("");
    }

classNameChars "class name"
  = head:[A-Z] tail:[_$a-zA-Z0-9]* {
      return head + tail.join("");
    }

jsIdentifierChars "Javascript identifier"
  = head:[_$a-zA-Z] tail:[_$a-zA-Z0-9]* {
      return head + tail.join("");
    }

// Strings
// -------

string
  = parts:('"' doubleQuotedStringChars? '"' / "'" singleQuotedStringChars? "'") {
      return parts[1];
    }

doubleQuotedStringChars
  = chars:doubleQuotedStringChar+ {
      return chars.join("");
    }

singleQuotedStringChars
  = chars:singleQuotedStringChar+ {
      return chars.join("");
    }

doubleQuotedStringChar
  = !('"' / "\\") char_:sourceChar {
      return char_;
    }
  / "\\" seq:escapeSequence {
      return seq;
    }

singleQuotedStringChar
  = !("'" / "\\") char_:sourceChar {
      return char_;
    }
  / "\\" seq:escapeSequence {
      return seq;
    }

escapeSequence
  = charEscapeSequence
  / nullEscapeSequence
  / hexEscapeSequence
  / unicodeEscapeSequence

hexEscapeSequence
  = "x" h1:digitHex h2:digitHex {
      return String.fromCharCode(parseInt("0x" + h1 + h2));
    }

unicodeEscapeSequence
  = "u" h1:digitHex h2:digitHex h3:digitHex h4:digitHex {
      return String.fromCharCode(parseInt("0x" + h1 + h2 + h3 + h4));
    }

nullEscapeSequence
  = "0" !digit {
      return "\0";
    }

charEscapeSequence
  = singleEscapeChar
  / nonEscapeChar

singleEscapeChar
  = char_:['"\\bfnrtv] {
      return char_
        .replace("b", "\b")
        .replace("f", "\f")
        .replace("n", "\n")
        .replace("r", "\r")
        .replace("t", "\t")
        .replace("v", "\x0B");
    }

nonEscapeChar
  = !escapeChar char_:sourceChar {
      return char_;
    }

escapeChar
  = singleEscapeChar
  / digit
  / "x"
  / "u"

sourceChar
  = .

// Numbers
// -------

number
  = int_:integer frac:fraction exp:exponent {
      return int_ + frac + exp;
    }
  / int_:integer frac:fraction {
      return int_ + frac;
    }
  / int_:integer exp:exponent {
      return int_ + exp;
    }
  / integer

integer
  = positiveInteger
  / negativeInteger

positiveInteger
  = digitsTenPlus
  / digit

negativeInteger
  = "-" digits:digitsTenPlus {
      return "-" + digits;
    }
  / "-" digit:digit {
      return "-" + digit;
    }

fraction
  = "." digits:digits {
      return "." + digits;
    }

exponent
  = e:eSign digits:digits {
      return e + digits;
    }

eSign
  = e:[eE] sign:[+-]? {
      return e + sign;
    }

digitsTenPlus
  = digit:digitNoZero digits:digits {
      return digit + digits;
    }

digits
  = digits:digit+ {
      return digits.join("");
    }

digitHex
  = [0-9a-fA-F]

digitNoZero
  = [1-9]

digit
  = [0-9]


// Whitespace
// ----------

_ 
  = whitespace*

whitespace 
  = " "
