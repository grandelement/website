/* Deprecated compatibility loader.
   Canonical client: ge-vault-client.js
   This file contains no Vault logic so loading both names cannot double-count analytics. */
(function(){
  'use strict';
  if(window.GEVault)return;
  try{
    const current=document.currentScript&&document.currentScript.src?new URL(document.currentScript.src,location.href):new URL('vault-client.js',location.href);
    current.pathname=current.pathname.replace(/vault-client\.js$/,'ge-vault-client.js');
    current.search='';
    const s=document.createElement('script');
    s.src=current.href;
    s.async=false;
    document.head.appendChild(s);
  }catch(_e){}
})();
