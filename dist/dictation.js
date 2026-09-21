(function(root){
class DictationDraft {
  constructor(){this.base='';this.parts=new Map();}
  update(text,final,key){if(!text.trim())return;this.parts.set(key,{text:text.trim(),final});}
  get text(){return [this.base,...Array.from(this.parts.values(),p=>p.text)].filter(Boolean).join(' ').slice(0,4000);}
  seal(){this.base=this.text;this.parts.clear();return this.base;}
  edit(text){this.base=text.slice(0,4000);this.parts.clear();}
}
DictationDraft.shouldAutoFinish=({hasText,sinceText,sinceSound})=>Boolean(hasText)&&sinceText>2400&&(sinceSound>900||sinceText>4200);
if(typeof module!=='undefined'&&module.exports)module.exports=DictationDraft;else root.DictationDraft=DictationDraft;
})(globalThis);
