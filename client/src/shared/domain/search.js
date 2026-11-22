import nameGroups from "./search-names.json" with { type: "json" };

export const normalizeSearch = value => String(value || '').toLowerCase().replaceAll('ё','е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const groups = nameGroups.map(g => g.split(' '));
const aliases = word => new Set([word, ...groups.filter(g => g.includes(word)).flat()]);
function oneEdit(a,b) {
  if (Math.abs(a.length-b.length)>1) return false;
  let i=0,j=0,edits=0;
  while(i<a.length && j<b.length) {
    if(a[i]===b[j]) {i++;j++;continue;}
    if(++edits>1) return false;
    if(a.length>=b.length)i++;
    if(b.length>=a.length)j++;
  }
  return edits + (i<a.length || j<b.length ? 1 : 0)<=1;
}
export function searchScore(query,text,{names=false}={}) {
  const q=normalizeSearch(query), value=normalizeSearch(text);
  if(!q) return 0;
  if(value===q) return 120;
  if(value.includes(q)) return 100;
  const words=value.split(' '), tokens=q.split(' ');
  let score=0;
  for(const token of tokens) {
    const options=names ? aliases(token) : new Set([token]);
    if(words.some(w=>options.has(w))) score+=90;
    else if(words.some(w=>[...options].some(o=>w.startsWith(o)))) score+=80;
    else if(token.length>=4 && words.some(w=>oneEdit(token,w))) score+=55;
    else return 0;
  }
  return score/tokens.length;
}
