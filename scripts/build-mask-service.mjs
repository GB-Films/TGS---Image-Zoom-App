import { build } from "vite";
import { cp, mkdir } from "node:fs/promises";

// Separate artifact from the Pages frontend; contains only the API and its migrations.
await build({configFile:false,publicDir:false,build:{outDir:"dist",emptyOutDir:true,
  lib:{entry:"service/masks.mjs",formats:["es"],fileName:()=>"server/index.js"},minify:false}});
await mkdir("dist/.openai",{recursive:true});
await cp(".openai/hosting.json","dist/.openai/hosting.json");
await cp("drizzle","dist/.openai/drizzle",{recursive:true});
