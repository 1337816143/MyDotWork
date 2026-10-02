/* Restore appearance before body content or styles can paint; no requests. */
(() => {
  const preference={layout:'B',color:'dark',effects:'auto'};
  try {
    const saved=JSON.parse(localStorage.getItem('mydotwork-appearance')||'null');
    if(saved && ['A','B'].includes(saved.layout) && ['dark','light'].includes(saved.color)){
      preference.layout=saved.layout;preference.color=saved.color;
      if(['auto','full','solid'].includes(saved.effects))preference.effects=saved.effects;
    }
  } catch {}
  const blurSupported=typeof CSS!=='undefined'&&(CSS.supports('backdrop-filter','blur(1px)')||CSS.supports('-webkit-backdrop-filter','blur(1px)'));
  const constrained=!blurSupported||Boolean(navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory<4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency<4));
  const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const glass=reduced||preference.effects==='solid'||(preference.effects==='auto'&&constrained)?'solid':'full';
  const root=document.documentElement;
  root.dataset.layout=preference.layout;
  root.dataset.color=preference.layout==='A'?'light':preference.color;
  root.dataset.glass=glass;
  window.WorkbenchAppearance=preference;
  window.WorkbenchBoot={beforeBody:document.body===null,layout:root.dataset.layout,color:root.dataset.color,glass,constrained};
})();
