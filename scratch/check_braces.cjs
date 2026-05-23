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

	if (braces < 0) {
		console.log(
			`Braces went negative at character ${i} (line ${content.slice(0, i).split("\n").length})`,
		);
		break;
	}
	if (brackets < 0) {
		console.log(
			`Brackets went negative at character ${i} (line ${content.slice(0, i).split("\n").length})`,
		);
		break;
	}
	if (parens < 0) {
		console.log(
			`Parens went negative at character ${i} (line ${content.slice(0, i).split("\n").length})`,
		);
		break;
	}
}

console.log(
	`Final counts -> Braces: ${braces}, Brackets: ${brackets}, Parens: ${parens}`,
);
