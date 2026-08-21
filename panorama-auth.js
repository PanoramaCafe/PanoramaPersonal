/* Panorama Personal: bootstrap de instalacion PWA. */
(function(){
  if(document.head){
    if(!document.querySelector('link[rel="manifest"]')){
      const link=document.createElement('link');
      link.rel='manifest';
      link.href='./manifest.json';
      document.head.appendChild(link);
    }
    const meta=document.createElement('meta');
    meta.name='apple-mobile-web-app-capable';
    meta.content='yes';
    document.head.appendChild(meta);
    const title=document.createElement('meta');
    title.name='apple-mobile-web-app-title';
    title.content='Panorama Personal';
    document.head.appendChild(title);
  }
})();
