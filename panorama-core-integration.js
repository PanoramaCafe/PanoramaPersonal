/* Panorama Personal — layout restoration hotfix */
(function(){
  const s=document.createElement('style');s.id='panorama-layout-restore';s.textContent=`
  @media (min-width:901px){
    .clock-workspace{display:grid!important;grid-template-columns:minmax(360px,1fr) minmax(300px,.72fr)!important;gap:14px!important;align-items:stretch!important;width:100%!important}
    .clock-workspace>.card{margin-top:0!important}
    .clock-workspace>.clock-home{max-width:none!important;margin:0!important}
    .clock-workspace .pinpad{max-width:360px!important}
    .clock-workspace .working-person{width:100%!important}
    .clock-workspace #workingNowList{display:flex!important;flex-direction:column!important;gap:8px!important}
    .clock-workspace .working-empty{min-height:180px!important;display:flex!important;align-items:center!important;justify-content:center!important}
  }
  @media (max-width:900px){.clock-workspace{display:block!important}.clock-workspace>.card{margin-top:14px!important}}
  `;document.head.appendChild(s);
})();
