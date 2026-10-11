import {cpSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),output=resolve(root,'docs');
rmSync(output,{recursive:true,force:true});mkdirSync(output,{recursive:true});cpSync(resolve(root,'public'),output,{recursive:true});
// Reuse the actual app shell; no framework or server code is shipped to Pages.
const source=readFileSync(resolve(root,'app/page.tsx'),'utf8');
const hash=createHash('sha256').update(source).update(readFileSync(new URL(import.meta.url)));
const browserFiles=readdirSync(output).filter(name=>/\.(js|mjs|css|svg)$/.test(name)).sort();
for(const name of browserFiles)hash.update(readFileSync(resolve(output,name)));
const version=hash.digest('hex').slice(0,12);
// Version module imports as well as entry scripts so returning students receive the same release.
for(const name of browserFiles.filter(name=>/\.(js|mjs)$/.test(name))){const file=resolve(output,name);writeFileSync(file,readFileSync(file,'utf8').replace(/(from\s*['"])(\.\/[\w.-]+\.(?:mjs|js))(['"])/g,`$1$2?v=${version}$3`));}
let body=source.split('return <>')[1].split('</>;')[0].trim();
body=body.replaceAll('className=','class=').replace('tabIndex={-1}','tabindex="-1"').replace(/<script dangerouslySetInnerHTML=.+?\/>/,'').replace('<GameLoader/>','<script src="config.js"></script><script type="module" src="app.js"></script>').replace('href="/assets/','href="assets/');
body=body.replace(/<nav aria-label="Main navigation">[\s\S]*?<\/nav>/,'<nav aria-label="Student navigation"><a href="#live-join" data-nav="live-join">Join game</a><a href="#home" data-nav="home">Practice</a><a href="#resources" data-nav="resources">Revision kit</a></nav>');
body=body.replace('src="config.js"',`src="config.js?v=${version}"`).replace('src="app.js"',`src="app.js?v=${version}"`);
const html=`<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f7f5ee"><meta name="description" content="Join Teacher Reen’s live philosophy game. Enter your PIN and name."><title>Join Jom Philosophy!</title><link rel="icon" href="icon.svg"><link rel="stylesheet" href="style.css"></head><body>${body}</body></html>\n`;
writeFileSync(resolve(output,'index.html'),html);
// Support existing Pages sites that publish main/(root), as well as main/docs.
writeFileSync(resolve(root,'index.html'),html.replace('<head>','<head><base href="./docs/">'));
writeFileSync(resolve(output,'config.js'),'window.JOM_CONFIG='+JSON.stringify({audience:'student',apiBase:'https://jom-philosophy-reen.izreenaisya.chatgpt.site',studentUrl:'https://izreenaisya-jpg.github.io/psychology-game/',defaultRoute:'live-join'})+';\n');
writeFileSync(resolve(output,'.nojekyll'),'');
writeFileSync(resolve(root,'.nojekyll'),'');
console.log('GitHub Pages student site prepared in docs/.');
