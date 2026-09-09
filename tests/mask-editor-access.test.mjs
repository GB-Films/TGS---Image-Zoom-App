import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the only editor entry is behind the password dialog and exiting relocks it", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.equal([...page.matchAll(/setDeveloperMode\(true\)/g)].length, 1);
  assert.match(page, /onUnlock=\{\(\) => \{\s*setEditorAccessRequested\(false\);\s*frameTransition\(editingTransition\);\s*setDeveloperMode\(true\);/);
  assert.match(page, /if \(developerMode\) \{ sharedMasks.exit\(\); setDeveloperMode\(false\); \}\s*else setEditorAccessRequested\(true\);/);
  assert.match(page, /\[developerMode, setDeveloperMode\] = useState\(false\)/);
});

test("password dialog asks the server, supports cancellation, and never stores access", async () => {
  const dialog = await readFile(new URL("../app/mask-editor-access.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(dialog, /EDITOR_PASSWORD|password !==|password ===/);
  assert.match(dialog, /await authenticate\(password,controller.signal\)/);
  assert.match(dialog, /if \(!controller.signal.aborted\) onUnlock\(\)/);
  assert.match(dialog, /type="password"/);
  assert.match(dialog, /showModal\(\)/);
  assert.match(dialog, /onCancel=\{.*onCancel\(\)/);
  assert.match(dialog, /previousFocus\.focus\(\)/);
  assert.doesNotMatch(dialog, /localStorage|sessionStorage|fetch\(/);
});

test("visitors use published data; local drafts are restored only explicitly", async () => {
  const hook = await readFile(new URL("../app/use-shared-masks.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(hook, /if \(first\) accept\(data\)/);
  assert.match(hook, /else if \(data.version > current.current.published.version\) setPending\(data\)/);
  assert.match(hook, /const restoreDraft = \(\) => \{[\s\S]*?localStorage.getItem/);
  assert.match(hook, /if \(!editing \|\| dragging \|\| !dirty\) return/);
  assert.doesNotMatch(page, /localStorage/);
  assert.match(page, /authenticate=\{sharedMasks.login\}/);
  assert.match(page, /Publicar para todos/);
});
