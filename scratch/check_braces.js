const fs = require("node:fs");
const content = fs.readFileSync(
	"i:/01-Master_Code/Apps/AI-Bookmark-Manager/src/components/OrganizeView.tsx",
	"utf8",
);

let braces = 0;
let brackets = 0;
let parens = 0;

for (let i = 0; i < content.length; i++) {
	const char = content[i];
	if (char === "{") braces++;
	else if (char === "}") braces--;
	else if (char === "[") brackets++;
	else if (char === "]") brackets--;
	else if (char === "(") parens++;
	else if (char === ")") parens--;

	if (braces < 0) console.log(`Braces negative at char ${i}`);
	if (brackets < 0) console.log(`Brackets negative at char ${i}`);
	if (parens < 0) console.log(`Parens negative at char ${i}`);
}

console.log(`Braces: ${braces}, Brackets: ${brackets}, Parens: ${parens}`);
