import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import fs from "fs";
import path from "path";

const prod = (process.argv[2] === "production");
const distDir = "dist";

if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir, { recursive: true });
}

const context = await esbuild.context({
	entryPoints: ["main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: path.join(distDir, "main.js"),
	minify: prod,
});

if (prod) {
	await context.rebuild();
	
	// Minify CSS in production mode
	if (fs.existsSync("styles.css")) {
		console.log("Minifying CSS...");
		const css = fs.readFileSync("styles.css", "utf8");
		
		// Use esbuild's CSS minification
		const result = await esbuild.transform(css, {
			loader: "css",
			minify: true
		});
		
		// Write to dist directory
		fs.writeFileSync(path.join(distDir, "styles.css"), result.code);
		console.log("CSS minification complete");
	}
	
	// Copy manifest.json to dist directory
	if (fs.existsSync("manifest.json")) {
		console.log("Copying manifest.json to dist directory...");
		fs.copyFileSync("manifest.json", path.join(distDir, "manifest.json"));
		console.log("Manifest copied successfully");
	}
	
	process.exit(0);
} else {
	await context.watch();
}
