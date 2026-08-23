/* Panorama Personal — restore clock workspace layout without touching sync */
(function(){
  function restore(){
    const reloj=document.getElementById('reloj');
    if(!reloj)return;
    let workspace=reloj.querySelector('.clock-workspace');
    const clock=reloj.querySelector('.clock-home');
    const working=clock&&Array.from(reloj.querySelectorAll(':scope > .card')).find(x=>x!==clock&&x.querySelector('#workingNowList'));
    if(clock&&working){
      if(!workspace){
        workspace=document.createElement('div');
        workspace.className='clock-workspace';
        reloj.insertBefore(workspace,clock);
        workspace.appendChild(clock);
        workspace.appendChild(working);
      }
      clock.style.maxWidth='none';
      clock.style.margin='0';
    }
  }
  const s=document.createElement('style');
  s.id='panorama-layout-restore';
  s.textContent=`
    @media (min-width:801px){
      #reloj .clock-workspace{display:grid!important;grid-template-columns:minmax(380px,1.15fr) minmax(300px,.85fr)!important;gap:14px!important;align-items:stretch!important;width:100%!important}
      #reloj .clock-workspace>.card{margin-top:0!important;width:100%!important}
      #reloj .clock-workspace>.clock-home{max-width:none!important;margin:0!important}
      #reloj .clock-workspace .pinpad{max-width:340px!important}
      #reloj .clock-workspace #workingNowList{display:flex!important;flex-direction:column!important;gap:8px!important}
      #reloj .clock-workspace .working-person{width:100%!important}
      #reloj .clock-workspace .working-empty{min-height:220px!important;display:flex!important;align-items:center!important;justify-content:center!important}
    }
    @media (max-width:800px){#reloj .clock-workspace{display:block!important}#reloj .clock-workspace>.card+ .card{margin-top:14px!important}}
  `;
  document.head.appendChild(s);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore);else restore();
  window.addEventListener('load',restore);
})();
