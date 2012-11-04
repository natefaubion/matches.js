DIR     = lib
UGLIFY  = $(shell find node_modules -name "uglifyjs" -type f)
MOCHA   = $(shell find node_modules -name "mocha" -type f)

all: clean matches.min.js

matches.min.js: matches.js
	@$(UGLIFY) $< > $@

clean:
	@rm -f matches.min.js

test:
	@$(MOCHA) --ui tdd

.PHONY: clean test
