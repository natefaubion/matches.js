{
  function headTailMerge (head, tail, index) {
    var result = [head];
    for (var i = 0; i < tail.length; i++) {
      result.push(tail[i][index]);
    }
    return result;
  }

  function hasMultiRest (patterns) {
    var count = 0;
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].type === "rest" || patterns[i].type === "restIdentifier") {
        count += 1;
      }
      if (count > 1) return true;
    }
    return false;
  }
}

start
  = _ patternList:patternList _ "\n"? { return patternList; }

patternList
  = patterns:patterns {
      var pats = patterns.map(function (pat) {
        return pat.pattern;
      });
      return {
        pattern: pats.join(","),
        type: "patternList",
        value: patterns
      };
    }

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
  / emptyArray
  / emptyObject
  / arrayStrict
  / arrayRest
  / objectKeyValuesStrict
  / objectKeysStrict
  / typeLiteral
  / identifierLiteral

wildcard
  = "_" {
      return { 
        pattern: "_",
        type: "wildcard" 
      };
    }

nullLiteral
  = "null" {
      return { 
        pattern: "null",
        type: "null",
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
  = bool:("true" / "false") {
      return { 
        pattern: bool,
        type: "boolean",
        value: bool === "true"
      };
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

emptyArray
  = "[" _ "]" {
      return {
        pattern: "[]",
        type: "array",
        value: []
      };
    }

emptyObject
  = "{" _ "}" {
      return {
        pattern: "{}",
        type: "object",
        value: []
      };
    }

arrayStrict
  = "[" _ patterns:patterns _ "]" { 
      var pats = patterns.map(function (pat) {
        return pat.pattern;
      });
      return {
        pattern: "[" + pats.join(",") + "]",
        type: "array",
        value: patterns
      }
    }

arrayRest
  = "[" _ patterns:arrayRestPatterns _ "]" {
      var pats = patterns.map(function (pat) {
        return pat.pattern;
      });
      var pattern = "[" + pats.join(",") + "]";
      if (hasMultiRest(patterns)) {
        throw new SyntaxError("Multiple rest paramaters are not allowed in sub-pattern " + pattern);
      }
      return {
        pattern: pattern,
        type: "arrayRest",
        value: patterns
      }
    }

objectKeyValuesStrict
  = "{" _ kvpairs:keyValuePairs _ "}" { 
      var pairs = kvpairs.map(function (pair) {
        return pair[0] + ":" + pair[1].pattern;
      });
      return {
        pattern: "{" + pairs.join(",") + "}",
        type: "object",
        value: kvpairs
      };
    }

objectKeysStrict
  = "{" _ keys:objectKeys _ "}" {
      return {
        pattern: "{" + keys.join(",") + "}",
        type: "objectKeys",
        value: keys
      };
    }

typeLiteral
  = head:[A-Z] tail:[_$a-zA-Z0-9]* {
      var name = head + tail.join("");
      return {
        pattern: name,
        type: "typeLiteral",
        value: name
      };
    }

identifierLiteral
  = ident:identifier {
      return {
        pattern: ident, 
        type: "identifier",
        value: ident
      };
    }

keyValuePairs
  = head:keyValuePair tail:(_ "," _ keyValuePair)* {
      return headTailMerge(head, tail, 3);
    }

keyValuePair
  = key:jsIdentifier _ ":" _ pattern:pattern {
      return [key, pattern];
    }

objectKeys
  = head:jsIdentifier tail:(_ "," _ jsIdentifier)* {
      return headTailMerge(head, tail, 3);
    }

arrayRestPatterns
  = head:(restOrRestIdentifierLiteral / pattern) tail:(_ "," _ (restOrRestIdentifierLiteral / pattern))* {
      return headTailMerge(head, tail, 3);
    }

restOrRestIdentifierLiteral
  = restLiteral / restIdentifierLiteral

restIdentifierLiteral
  = ident:identifier rest {
      return {
        pattern: ident + "...",
        type: "restIdentifier",
        value: ident
      };
    }

restLiteral
  = rest {
      return {
        pattern: "...",
        type: "rest"
      };
    }

jsIdentifierLiteral
  = ident:jsIdentifier {
      return {
        pattern: ident,
        type: "jsIdentifier",
        value: ident 
      };
    }

jsIdentifier
  = head:[_$a-zA-Z] tail:[_$a-zA-Z0-9]* {
      return head + tail.join("");
    }

identifier
  = head:[a-z] tail:[_$a-zA-Z0-9]* {
      return head + tail.join("");
    }

rest
  = "..."

string
  = parts:('"' doubleStringChars? '"' / "'" singleStringChars? "'") {
      return parts[1]; 
    }

doubleStringChars
  = chars:doubleStringChar+ { return chars.join(""); }

singleStringChars
  = chars:singleStringChar+ { return chars.join(""); }

doubleStringChar
  = !('"' / "\\") char:sourceChar { return char; }
  / "\\" seq:escapeSequence       { return seq; }
  
singleStringChar
  = !("'" / "\\") char:sourceChar { return char; }
  / "\\" seq:escapeSequence       { return seq; }

escapeSequence
  = charEscapeSequence
  / "0" !digit { return "\0"; }
  / hexEscapeSequence
  / unicodeEscapeSequence

charEscapeSequence
  = singleEscapeChar
  / nonEscapeChar

singleEscapeChar
  = char:['"\\bfnrtv] {
    return char
      .replace("b", "\b")
      .replace("f", "\f")
      .replace("n", "\n")
      .replace("r", "\r")
      .replace("t", "\t")
      .replace("v", "\x0B");
    }

nonEscapeChar
  = !escapeChar char:sourceChar { return char; }

escapeChar
  = singleEscapeChar
  / digit
  / "x"
  / "u"

hexEscapeSequence
  = "x" h1:hexDigit h2:hexDigit {
      return String.fromCharCode(parseInt("0x" + h1 + h2));
    }

unicodeEscapeSequence
  = "u" h1:hexDigit h2:hexDigit h3:hexDigit h4:hexDigit {
      return String.fromCharCode(parseInt("0x" + h1 + h2 + h3 + h4));
    }

sourceChar
  = .

number
  = int:int frac:frac exp:exp { return int + frac + exp; }
  / int:int frac:frac         { return int + frac; }
  / int:int exp:exp           { return int + exp; }
  / int:int                   { return int; }

int
  = digitBig
  / digit
  / "-" digitBig:digitBig { return "-" + digitBig; }
  / "-" digit:digit       { return "-" + digit; }

frac
  = "." digits:digits { return "." + digits; }

exp
  = e:e digits:digits { return e + digits; }

e
  = e:[eE] sign:[+-]? { return e + sign; }

digitBig
  = digit1:digitNoZero digits:digits { return digit1 + digits; }

digits
  = digits:digit+ { return digits.join(""); }

digit
  = [0-9]

digitNoZero
  = [1-9]

hexDigit
  = [0-9a-fA-F]

_ "whitespace"
  = whitespace*

whitespace
  = " "
