// A deliberately small DOM fixture for event/controller checks. No layout, browser,
// native-input, IndexedDB, screen-reader or pixel claims may be inferred from it.
class FixtureNode {
  constructor(tag,owner){this.tagName=tag.toUpperCase();this.ownerDocument=owner;this.children=[];this.parentNode=null;this.attributes={};this.dataset={};this.handlers=new Map();this.className='';this._value='';this._text='';this.checked=false;this.disabled=false;this.selected=false;this.open=false;this.selectionStart=null;this.selectionEnd=null;}
  append(...nodes){for(let node of nodes){if(typeof node!=='object')node=this.ownerDocument.createTextNode(String(node));if(node.parentNode)node.remove();node.parentNode=this;this.children.push(node)}}
  replaceChildren(...nodes){for(const child of this.children)child.parentNode=null;this.children=[];this._text='';this.append(...nodes)}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null}}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='class')this.className=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);if(k==='selected')this.selected=true;if(k==='type')this.type=String(v)}
  getAttribute(k){if(k==='class')return this.className;if(k.startsWith('data-'))return this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]??null;return this.attributes[k]??null}
  removeAttribute(k){delete this.attributes[k]}
  addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push(fn)}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('')}
  set textContent(value){this.replaceChildren();this._text=String(value)}
  get value(){if(this.tagName==='SELECT')return this.children.find(o=>o.selected)?.value??this.children[0]?.value??'';if(this.tagName==='TEXTAREA')return this._value||this.textContent;return this._value}
  set value(v){this._value=String(v);if(this.tagName==='SELECT')for(const option of this.children)option.selected=option.value===String(v)}
  get isConnected(){let n=this;while(n){if(n===this.ownerDocument.documentElement)return true;n=n.parentNode}return false}
  contains(node){return this===node||this.children.some(c=>c.contains(node))}
  focus(){this.ownerDocument.activeElement=this}
  scrollIntoView(){}
  setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end}
  showModal(){this.open=true}
  close(){this.open=false;for(const fn of this.handlers.get('close')||[])fn({target:this,currentTarget:this})}
  click(){return fire(this,'click')}
  matches(selector){
    if(selector.startsWith('#'))return this.getAttribute('id')===selector.slice(1);
    const m=selector.match(/^([a-z]+)?\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/i);
    if(m)return (!m[1]||this.tagName===m[1].toUpperCase())&&(m[3]===undefined?this.getAttribute(m[2])!==null:this.getAttribute(m[2])===m[3]);
    return this.tagName===selector.toUpperCase();
  }
  querySelectorAll(selector){const selectors=selector.split(',').map(s=>s.trim()),found=[];const visit=node=>{for(const child of node.children){if(selectors.some(s=>child.matches(s)))found.push(child);visit(child)}};visit(this);return found}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null}
}
class FixtureDocument {
  constructor(){this.documentElement=new FixtureNode('html',this);this.body=new FixtureNode('body',this);this.documentElement.append(this.body);this.activeElement=this.body;this.app=this.createElement('div');this.app.setAttribute('id','app');this.body.append(this.app)}
  createElement(tag){return new FixtureNode(tag,this)}
  createElementNS(namespace,tag){const n=this.createElement(tag);n.namespaceURI=namespace;return n}
  createTextNode(text){const n=new FixtureNode('#text',this);n._text=String(text);return n}
  getElementById(id){return this.documentElement.querySelector(`#${id}`)}
  querySelector(selector){return this.documentElement.querySelector(selector)}
  querySelectorAll(selector){return this.documentElement.querySelectorAll(selector)}
}
export function installDomFixture(){
  const document=new FixtureDocument(),events=new Map(),storage=new Map();
  const location={hash:'#view=desk',origin:'https://example.github.io',reload(){}};
  const history={state:null,replaceState(state,unused,url){this.state=structuredClone(state);if(url)location.hash=url},pushState(state,unused,url){this.state=structuredClone(state);if(url)location.hash=url}};
  Object.assign(globalThis,{document,Node:FixtureNode,location,history,scrollY:0,scrollTo(){},requestAnimationFrame:fn=>fn(),addEventListener:(name,fn)=>events.set(name,fn),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});
  return {document,events,location,history};
}
export async function fire(element,type,props={}){if(!element)throw new Error(`No element for ${type}`);const event={target:element,currentTarget:element,button:0,preventDefault(){},...props};for(const fn of element.handlers.get(type)||[])await fn(event);await new Promise(r=>setImmediate(r))}
export async function input(form,name,value){const field=form.querySelector(`[name="${name}"]`);if(!field)throw new Error(`Missing input ${name}`);if(field.type==='checkbox')field.checked=value;else field.value=value;await fire(field,field.tagName==='SELECT'?'change':'input')}
export async function submit(form){await fire(form,'submit',{submitter:form.querySelector('[type="submit"]')})}
export function findButton(root,label){return root.querySelectorAll('button').find(b=>b.textContent===label)}
