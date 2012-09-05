{
  function headTailMerge (head, tail, index) {
    var result = [head];
    for (var i = 0; i < tail.length; i++) {
      result.push(tail[i][index]);
    }
    return result;
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
  / booleanLiteral
  / numberLiteral
  / stringLiteral
  / emptyArray
  / emptyObject
  / arrayStrict
  / objectKeyValuesStrict
  / objectKeysStrict
  / identifier

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

identifier
  = head:[a-z] tail:[_$a-zA-Z0-9]* {
      var ident = head + tail.join("");
      return {
        pattern: ident, 
        type: "identifier",
        value: ident
      };
    }

jsIdentifier
  = head:[_$a-zA-Z] tail:[_$a-zA-Z0-9]* {
      return head + tail.join("");
    }

string "string"
  = '"' '"'             { return ""; }
  / '"' chars:chars '"' { return chars; }

chars
  = chars:char+ { return chars.join(""); }

char
  = [^"\\\0-\x1F\x7f]
  / '\\"'  { return '"';  }
  / "\\\\" { return "\\"; }
  / "\\/"  { return "/";  }
  / "\\b"  { return "\b"; }
  / "\\f"  { return "\f"; }
  / "\\n"  { return "\n"; }
  / "\\r"  { return "\r"; }
  / "\\t"  { return "\t"; }
  / "\\u" h1:hexDigit h2:hexDigit h3:hexDigit h4:hexDigit {
      return String.fromCharCode(parseInt("0x" + h1 + h2 + h3 + h4));
    }

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
